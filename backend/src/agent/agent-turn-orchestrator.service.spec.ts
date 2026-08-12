import type { AgentToolExecutor } from './agent-tool-executor.service';
import { AgentTurnOrchestrator } from './agent-turn-orchestrator.service';
import type {
  AgentProvider,
  AgentProviderTurn,
  AgentTurnEvent,
  ProviderEvent,
  ProviderTurnRequest,
} from './contracts/provider-contracts';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_VERSION,
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
} from './contracts/tool-contracts';
import { FakeAgentProvider } from './providers/fake-agent.provider';

describe('AgentTurnOrchestrator', () => {
  const successfulToolResult = {
    ok: true,
    tool: 'format_json',
    callId: 'call-1',
    data: { output: '{\n  "a": 1\n}' },
    validation: { engine: 'jason', valid: true },
  } as const;
  const executeMock = jest.fn().mockResolvedValue(successfulToolResult);
  const executor = {
    execute: executeMock,
  } as unknown as jest.Mocked<AgentToolExecutor>;
  const orchestrator = new AgentTurnOrchestrator(executor);

  beforeEach(() => jest.clearAllMocks());

  it('runs one turn session across two rounds, executes tools sequentially, and closes', async () => {
    const provider = new FakeAgentProvider([
      [
        {
          type: 'tool_call_complete',
          callId: 'call-1',
          tool: 'format_json',
          argumentsJson: '{"input":"{\\"a\\":1}"}',
        },
        { type: 'completed', finishReason: 'tool' },
      ],
      [
        { type: 'text_delta', text: 'Jason validated the formatted JSON.' },
        { type: 'completed', finishReason: 'stop' },
      ],
    ]);

    const events = await collect(
      orchestrator.streamTurn(
        provider,
        createRequest(),
        new AbortController().signal,
      ),
    );

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(provider.turns[0].receivedToolResults).toEqual([
      [],
      [successfulToolResult],
    ]);
    expect(provider.turns[0].closeCount).toBe(1);
    expect(events).toContainEqual({
      type: 'tool_result',
      result: successfulToolResult,
    });
  });

  it('rejects duplicate call IDs and always closes the provider turn', async () => {
    const provider = new FakeAgentProvider([
      [
        toolCall('call-1'),
        toolCall('call-1'),
        { type: 'completed', finishReason: 'tool' },
      ],
    ]);

    await expect(
      collect(
        orchestrator.streamTurn(
          provider,
          createRequest(),
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE_TOOL_CALL' });
    expect(provider.turns[0].closeCount).toBe(1);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects more than two tool calls without executing any partial batch', async () => {
    const provider = new FakeAgentProvider([
      [
        toolCall('call-1'),
        toolCall('call-2'),
        toolCall('call-3'),
        { type: 'completed', finishReason: 'tool' },
      ],
    ]);

    await expect(
      collect(
        orchestrator.streamTurn(
          provider,
          createRequest(),
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ code: 'TOOL_LIMIT_EXCEEDED' });
    expect(executeMock).not.toHaveBeenCalled();
    expect(provider.turns[0].closeCount).toBe(1);
  });

  it('does not execute a tool requested after the second and final round trip', async () => {
    const provider = new FakeAgentProvider([
      [toolCall('call-1'), { type: 'completed', finishReason: 'tool' }],
      [toolCall('call-2'), { type: 'completed', finishReason: 'tool' }],
    ]);

    await expect(
      collect(
        orchestrator.streamTurn(
          provider,
          createRequest(),
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ code: 'ROUND_LIMIT_EXCEEDED' });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(provider.turns[0].closeCount).toBe(1);
  });

  it('passes through normalized provider failures and closes cleanly', async () => {
    const provider = new FakeAgentProvider([
      [
        {
          type: 'provider_error',
          retryable: true,
          code: 'rate_limit_exceeded',
          safeMessage: 'The provider is unavailable.',
        },
      ],
    ]);

    const events = await collect(
      orchestrator.streamTurn(
        provider,
        createRequest(),
        new AbortController().signal,
      ),
    );

    expect(events).toHaveLength(1);
    expect(provider.turns[0].closeCount).toBe(1);
  });

  it('rejects malformed provider streams and unknown tools', async () => {
    const incompleteProvider = new FakeAgentProvider([
      [{ type: 'text_delta', text: 'unfinished' }],
    ]);

    await expect(
      collect(
        orchestrator.streamTurn(
          incompleteProvider,
          createRequest(),
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_PROTOCOL_ERROR' });
    expect(incompleteProvider.turns[0].closeCount).toBe(1);

    const unknownToolProvider = new FakeAgentProvider([
      [
        {
          type: 'tool_call_complete',
          callId: 'call-unknown',
          tool: 'read_database',
          argumentsJson: '{}',
        } as unknown as ProviderEvent,
      ],
    ]);

    await expect(
      collect(
        orchestrator.streamTurn(
          unknownToolProvider,
          createRequest(),
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ code: 'UNKNOWN_TOOL' });
    expect(unknownToolProvider.turns[0].closeCount).toBe(1);
  });

  it('propagates cancellation and disposes the turn session', async () => {
    const abortController = new AbortController();
    let closeCount = 0;
    const turn: AgentProviderTurn = {
      async *streamRound() {
        await Promise.resolve();
        yield { type: 'turn_started' };
        abortController.abort(new Error('cancelled by test'));
        yield { type: 'completed', finishReason: 'stop' };
      },
      close() {
        closeCount += 1;
        return Promise.resolve();
      },
    };
    const provider: AgentProvider = {
      id: 'openai',
      capabilities: {
        streaming: true,
        strictTools: true,
        lowReasoningProfile: true,
        statelessMode: true,
      },
      createTurn: () => Promise.resolve(turn),
    };

    await expect(
      collect(
        orchestrator.streamTurn(
          provider,
          createRequest(),
          abortController.signal,
        ),
      ),
    ).rejects.toThrow('cancelled by test');
    expect(closeCount).toBe(1);
  });
});

function createRequest(): ProviderTurnRequest {
  return {
    contractVersion: AGENT_CONTRACT_VERSION,
    promptVersion: AGENT_PROMPT_VERSION,
    systemInstruction: 'Static test instruction.',
    visibleMessages: [{ role: 'user', content: 'Format the selected JSON.' }],
    tools: AGENT_TOOL_DEFINITIONS,
    limits: {
      maxRoundTrips: AGENT_RUNTIME_LIMITS.modelRoundTripsPerTurn,
      maxToolCalls: AGENT_RUNTIME_LIMITS.toolCallsPerTurn,
      maxOutputTokens: AGENT_RUNTIME_LIMITS.maxOutputTokens,
      reasoningProfile: 'low',
      latencyTier: 'standard',
    },
    privacy: { retainProviderState: false, abuseIdentifier: 'anon-hash' },
  };
}

function toolCall(callId: string): AgentTurnEvent {
  return {
    type: 'tool_call_complete',
    callId,
    tool: 'format_json',
    argumentsJson: '{"input":"{}"}',
  };
}

async function collect(
  events: AsyncIterable<AgentTurnEvent>,
): Promise<AgentTurnEvent[]> {
  const result: AgentTurnEvent[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}
