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
import type { AgentVisibleMessage } from '../contracts/http-contracts';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_VERSION,
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
  type AgentToolName,
} from '../contracts/tool-contracts';
import {
  summarizeRoutingEval,
  percentile,
  type RoutingEvalCaseResult,
  type RoutingEvalModel,
  type RoutingEvalSummary,
} from './routing-eval';
import type { RoutingFixture } from './routing-fixtures';

export type RoutingEvalSessionResult = {
  id: string;
  caseIds: string[];
  turns: number;
  usageEvidenceValid: boolean;
  estimatedCostMicroUsd: number | null;
};

export type RoutingEvalRunOptions = {
  turnsPerSession?: 1 | 3;
  stopOnError?: (error: string) => boolean;
};

export type RoutingEvalSessionCostSummary = {
  sessions: number;
  p95SessionCostMicroUsd: number | null;
  belowThirtyMilliUsd: boolean | null;
};

export class RoutingEvalRunner {
  private readonly validator = new AgentToolValidator();

  constructor(
    private readonly provider: AgentProvider,
    private readonly orchestrator: AgentTurnOrchestrator,
    private readonly model: RoutingEvalModel,
  ) {}

  async run(
    fixtures: readonly RoutingFixture[],
    options: RoutingEvalRunOptions = {},
  ): Promise<{
    cases: RoutingEvalCaseResult[];
    sessions: RoutingEvalSessionResult[];
    sessionCost: RoutingEvalSessionCostSummary;
    summary: RoutingEvalSummary;
    fatalError?: string;
  }> {
    const turnsPerSession = options.turnsPerSession ?? 1;
    const cases: RoutingEvalCaseResult[] = [];
    const sessions: RoutingEvalSessionResult[] = [];
    let sessionCases: RoutingEvalCaseResult[] = [];
    let transcript: AgentVisibleMessage[] = [];
    let fatalError: string | undefined;

    for (const fixture of fixtures) {
      const result = await this.runFixture(fixture, transcript);
      cases.push(result);
      sessionCases.push(result);
      transcript.push(
        { role: 'user', content: fixture.instruction },
        {
          role: 'assistant',
          content:
            result.responseText ||
            'The deterministic JSON operation completed without an additional message.',
        },
      );

      if (sessionCases.length === turnsPerSession) {
        sessions.push(summarizeSession(sessionCases, sessions.length));
        sessionCases = [];
        transcript = [];
      }
      if (result.error && options.stopOnError?.(result.error)) {
        fatalError = result.error;
        break;
      }
    }
    if (sessionCases.length > 0) {
      sessions.push(summarizeSession(sessionCases, sessions.length));
    }
    return {
      cases,
      sessions,
      sessionCost: summarizeSessionCosts(sessions, turnsPerSession),
      summary: summarizeRoutingEval(cases, this.model),
      ...(fatalError ? { fatalError } : {}),
    };
  }

  private async runFixture(
    fixture: RoutingFixture,
    visibleMessages: readonly AgentVisibleMessage[],
  ): Promise<RoutingEvalCaseResult> {
    const events: AgentTurnEvent[] = [];
    let error: string | undefined;

    try {
      for await (const event of this.orchestrator.streamTurn(
        this.provider,
        createProviderRequest(fixture, visibleMessages),
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

function createProviderRequest(
  fixture: RoutingFixture,
  visibleMessages: readonly AgentVisibleMessage[],
): ProviderTurnRequest {
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
          visibleMessages,
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

function summarizeSession(
  cases: readonly RoutingEvalCaseResult[],
  index: number,
): RoutingEvalSessionResult {
  const costs = cases.flatMap((item) =>
    item.estimatedCostMicroUsd === null ? [] : [item.estimatedCostMicroUsd],
  );
  return {
    id: `session-${index + 1}`,
    caseIds: cases.map((item) => item.id),
    turns: cases.length,
    usageEvidenceValid: cases.every((item) => item.usageEvidenceValid),
    estimatedCostMicroUsd:
      costs.length === cases.length
        ? costs.reduce((total, cost) => total + cost, 0)
        : null,
  };
}

function summarizeSessionCosts(
  sessions: readonly RoutingEvalSessionResult[],
  turnsPerSession: 1 | 3,
): RoutingEvalSessionCostSummary {
  const measuredCosts = sessions.flatMap((session) =>
    session.turns === 3 && session.estimatedCostMicroUsd !== null
      ? [session.estimatedCostMicroUsd]
      : [],
  );
  const measurementComplete =
    turnsPerSession === 3 &&
    sessions.length > 0 &&
    measuredCosts.length === sessions.length;
  const p95SessionCostMicroUsd = measurementComplete
    ? percentile(measuredCosts, 0.95)
    : null;
  return {
    sessions: sessions.length,
    p95SessionCostMicroUsd,
    belowThirtyMilliUsd:
      p95SessionCostMicroUsd === null ? null : p95SessionCostMicroUsd < 30_000,
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
