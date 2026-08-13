import { estimateLunaCostMicroUsd } from '../agent-cost';
import { AgentToolValidator } from '../agent-tool-validator.service';
import type { AgentTurnOrchestrator } from '../agent-turn-orchestrator.service';
import { AgentError } from '../agent.errors';
import {
  AGENT_SYSTEM_INSTRUCTION,
  serializeUntrustedAgentRequest,
} from '../agent.prompt';
import type {
  AgentProvider,
  AgentTurnEvent,
  ProviderTurnRequest,
} from '../contracts/provider-contracts';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_VERSION,
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
  type AgentToolName,
} from '../contracts/tool-contracts';
import {
  summarizeRoutingEval,
  type RoutingEvalCaseResult,
  type RoutingEvalModel,
  type RoutingEvalSummary,
} from './routing-eval';
import type { RoutingFixture } from './routing-fixtures';

export class RoutingEvalRunner {
  private readonly validator = new AgentToolValidator();

  constructor(
    private readonly provider: AgentProvider,
    private readonly orchestrator: AgentTurnOrchestrator,
    private readonly model: RoutingEvalModel,
  ) {}

  async run(
    fixtures: readonly RoutingFixture[],
  ): Promise<{ cases: RoutingEvalCaseResult[]; summary: RoutingEvalSummary }> {
    const cases: RoutingEvalCaseResult[] = [];
    for (const fixture of fixtures) {
      cases.push(await this.runFixture(fixture));
    }
    return { cases, summary: summarizeRoutingEval(cases, this.model) };
  }

  private async runFixture(
    fixture: RoutingFixture,
  ): Promise<RoutingEvalCaseResult> {
    const events: AgentTurnEvent[] = [];
    let error: string | undefined;

    try {
      for await (const event of this.orchestrator.streamTurn(
        this.provider,
        createProviderRequest(fixture),
        AbortSignal.timeout(AGENT_RUNTIME_LIMITS.requestTimeoutSeconds * 1_000),
      )) {
        events.push(event);
      }
    } catch (caught) {
      error =
        caught instanceof AgentError
          ? caught.code
          : caught instanceof Error
            ? caught.name
            : 'UnknownError';
    }

    const calls = events.filter((event) => event.type === 'tool_call_complete');
    const results = events.filter((event) => event.type === 'tool_result');
    const usage = events
      .filter((event) => event.type === 'usage')
      .reduce(
        (total, event) => ({
          inputTokens: total.inputTokens + event.inputTokens,
          outputTokens: total.outputTokens + event.outputTokens,
          cachedInputTokens:
            total.cachedInputTokens + (event.cachedInputTokens ?? 0),
        }),
        { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      );
    const toolCalls = calls.map((call) => ({
      callId: call.callId,
      tool: call.tool,
      schemaValid: this.argumentsAreValid(call.tool, call.argumentsJson),
    }));
    const patchCalls = toolCalls.filter(
      (call) => call.tool === 'apply_json_patch',
    );
    const patchResults = new Map(
      results
        .filter((event) => event.result.tool === 'apply_json_patch')
        .map((event) => [event.result.callId, event.result]),
    );
    const validPatchProposalCount = patchCalls.filter((call) => {
      const result = patchResults.get(call.callId);
      return (
        result?.ok === true &&
        result.validation.engine === 'jason' &&
        result.validation.valid
      );
    }).length;
    const completed = events.filter((event) => event.type === 'completed');
    const usageRecords = events.filter(
      (event) => event.type === 'usage',
    ).length;
    const usageEvidenceValid = hasCompleteUsageEvidence(events);
    const providerError = events.find(
      (event) => event.type === 'provider_error',
    );
    error ??= providerError?.code;
    if (!error && completed.some((event) => event.finishReason === 'length')) {
      error = 'output_limit';
    }
    if (!error && !usageEvidenceValid) {
      error = 'missing_usage';
    }

    return {
      id: fixture.id,
      category: fixture.category,
      expected: fixture.expected,
      observedTools: toolCalls.map((call) => call.tool),
      toolCalls,
      responseText: events
        .filter((event) => event.type === 'text_delta')
        .map((event) => event.text)
        .join(''),
      routingPass:
        error === undefined &&
        matchesExpectedRoute(
          fixture,
          calls.map((call) => call.tool),
        ),
      schemaValid: toolCalls.every((call) => call.schemaValid),
      patchProposalValid:
        patchCalls.length === 0
          ? null
          : validPatchProposalCount === patchCalls.length &&
            patchResults.size === patchCalls.length,
      patchProposalCount: patchCalls.length,
      validPatchProposalCount,
      usageEvidenceValid,
      completedRounds: completed.length,
      usageRecords,
      ...usage,
      estimatedCostMicroUsd:
        this.model === 'gpt-5.6-luna' && usageEvidenceValid
          ? estimateLunaCostMicroUsd(usage)
          : null,
      ...(error ? { error } : {}),
    };
  }

  private argumentsAreValid(
    tool: AgentToolName,
    argumentsJson: string,
  ): boolean {
    try {
      this.validator.validateArguments(tool, argumentsJson);
      return true;
    } catch {
      return false;
    }
  }
}

function createProviderRequest(fixture: RoutingFixture): ProviderTurnRequest {
  return {
    contractVersion: AGENT_CONTRACT_VERSION,
    promptVersion: AGENT_PROMPT_VERSION,
    systemInstruction: AGENT_SYSTEM_INSTRUCTION,
    visibleMessages: [
      {
        role: 'user',
        content: serializeUntrustedAgentRequest({
          sessionId: `eval-${fixture.id}`,
          selectedTool: fixture.selectedTool,
          instruction: fixture.instruction,
          context: fixture.context,
          visibleMessages: [],
        }),
      },
    ],
    tools: AGENT_TOOL_DEFINITIONS,
    limits: {
      maxRoundTrips: AGENT_RUNTIME_LIMITS.modelRoundTripsPerTurn,
      maxToolCalls: AGENT_RUNTIME_LIMITS.toolCallsPerTurn,
      maxOutputTokens: AGENT_RUNTIME_LIMITS.maxOutputTokens,
      reasoningProfile: 'low',
      latencyTier: 'standard',
    },
    privacy: {
      retainProviderState: false,
      abuseIdentifier: `askjason-eval-${fixture.id}`,
    },
  };
}

function matchesExpectedRoute(
  fixture: RoutingFixture,
  observedTools: readonly AgentToolName[],
): boolean {
  if (fixture.expected.decision !== 'tool') {
    return observedTools.length === 0;
  }
  const expectedTool = fixture.expected.tool;
  return (
    observedTools.length > 0 &&
    observedTools.every((tool) => tool === expectedTool)
  );
}

function hasCompleteUsageEvidence(events: readonly AgentTurnEvent[]): boolean {
  let completedRounds = 0;
  let usageSinceCompletion = 0;

  for (const event of events) {
    if (event.type === 'usage') {
      usageSinceCompletion += 1;
    }
    if (event.type === 'completed') {
      completedRounds += 1;
      if (usageSinceCompletion !== 1) {
        return false;
      }
      usageSinceCompletion = 0;
    }
  }

  return completedRounds > 0 && usageSinceCompletion === 0;
}
