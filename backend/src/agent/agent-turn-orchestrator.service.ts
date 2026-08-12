import { Injectable } from '@nestjs/common';
import { AgentError } from './agent.errors';
import { AgentToolExecutor } from './agent-tool-executor.service';
import type {
  AgentProvider,
  AgentTurnEvent,
  NormalizedToolResult,
  ProviderToolCall,
  ProviderTurnRequest,
} from './contracts/provider-contracts';
import {
  AGENT_RUNTIME_LIMITS,
  isAgentToolName,
} from './contracts/tool-contracts';

@Injectable()
export class AgentTurnOrchestrator {
  constructor(private readonly toolExecutor: AgentToolExecutor) {}

  async *streamTurn(
    provider: AgentProvider,
    request: ProviderTurnRequest,
    signal: AbortSignal,
  ): AsyncIterable<AgentTurnEvent> {
    throwIfAborted(signal);
    const turn = await provider.createTurn(request, signal);
    const seenCallIds = new Set<string>();
    let toolCallCount = 0;
    let toolResults: readonly NormalizedToolResult[] = [];

    try {
      for (
        let round = 0;
        round < AGENT_RUNTIME_LIMITS.modelRoundTripsPerTurn;
        round += 1
      ) {
        const calls: ProviderToolCall[] = [];
        let completed = false;
        let providerFailed = false;

        for await (const event of turn.streamRound(toolResults)) {
          throwIfAborted(signal);

          if (event.type === 'tool_call_complete') {
            if (!isAgentToolName(event.tool)) {
              throw new AgentError(
                'UNKNOWN_TOOL',
                'The provider requested a tool that is not available.',
              );
            }

            if (seenCallIds.has(event.callId)) {
              throw new AgentError(
                'DUPLICATE_TOOL_CALL',
                'The provider repeated a tool call identifier.',
              );
            }

            toolCallCount += 1;
            if (toolCallCount > AGENT_RUNTIME_LIMITS.toolCallsPerTurn) {
              throw new AgentError(
                'TOOL_LIMIT_EXCEEDED',
                'The provider exceeded the tool-call limit for this turn.',
              );
            }

            seenCallIds.add(event.callId);
            calls.push(event);
          }

          if (event.type === 'completed') {
            completed = true;
          }

          if (event.type === 'provider_error') {
            providerFailed = true;
          }

          yield event;
        }

        if (providerFailed) {
          return;
        }

        if (!completed) {
          throw new AgentError(
            'PROVIDER_PROTOCOL_ERROR',
            'The provider stream ended without a completion event.',
          );
        }

        if (calls.length === 0) {
          return;
        }

        if (round === AGENT_RUNTIME_LIMITS.modelRoundTripsPerTurn - 1) {
          throw new AgentError(
            'ROUND_LIMIT_EXCEEDED',
            'The provider requested another tool after the final model round trip.',
          );
        }

        const nextResults: NormalizedToolResult[] = [];
        for (const call of calls) {
          throwIfAborted(signal);
          const result = await this.toolExecutor.execute(call);
          nextResults.push(result);
          yield { type: 'tool_result', result };
        }
        toolResults = nextResults;
      }
    } finally {
      await turn.close();
    }
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('The agent turn was aborted.');
  }
}
