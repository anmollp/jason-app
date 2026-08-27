import type { AgentToolExecutor } from '../agent-tool-executor.service';
import { AgentTurnOrchestrator } from '../agent-turn-orchestrator.service';
import type {
  AgentProvider,
  AgentProviderTurn,
  NormalizedToolResult,
  ProviderEvent,
  ProviderTurnRequest,
} from '../contracts/provider-contracts';
import { FakeAgentProvider } from '../providers/fake-agent.provider';
import { RoutingEvalRunner } from './routing-eval-runner';
import type { RoutingFixture } from './routing-fixtures';

describe('RoutingEvalRunner', () => {
  it('runs the production turn shape and scores a schema-valid Rust proposal', async () => {
    const provider = new FakeAgentProvider([
      [
        patchCall('call-1'),
        usage(100),
        { type: 'completed', finishReason: 'tool' },
      ],
      [
        { type: 'text_delta', text: 'The patch is valid.' },
        usage(50, 5),
        { type: 'completed', finishReason: 'stop' },
      ],
    ]);
    const executor = {
      execute: jest.fn().mockResolvedValue(validPatchResult('call-1')),
    } as unknown as AgentToolExecutor;
    const runner = new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    );

    const report = await runner.run([patchFixture]);

    expect(report.cases[0]).toMatchObject({
      observedTools: ['apply_json_patch'],
      toolCalls: [
        {
          callId: 'call-1',
          tool: 'apply_json_patch',
          schemaValid: true,
        },
      ],
      routingPass: true,
      schemaValid: true,
      patchProposalValid: true,
      usageEvidenceValid: true,
      completedRounds: 2,
      usageRecords: 2,
      inputTokens: 150,
      outputTokens: 15,
      responseText: 'The patch is valid.',
    });
    expect(provider.requests[0].systemInstruction).toContain('AskJason');
    expect(provider.requests[0].privacy.retainProviderState).toBe(false);
    expect(provider.requests[0].visibleMessages[0].content).toContain(
      '"selectedTool":"patch"',
    );
  });

  it('fails routing and release readiness for provider errors', async () => {
    const provider = new FakeAgentProvider([
      [
        {
          type: 'provider_error',
          retryable: true,
          code: 'rate_limit_exceeded',
          safeMessage: 'Provider unavailable.',
        },
      ],
    ]);
    const executor = { execute: jest.fn() } as unknown as AgentToolExecutor;
    const runner = new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    );

    const report = await runner.run([patchFixture]);

    expect(report.cases[0]).toMatchObject({
      error: 'rate_limit_exceeded',
      routingPass: false,
    });
    expect(report.summary.thresholds.errorFree).toBe(false);
  });

  it('preserves safe orchestrator error codes in the report', async () => {
    const provider = new FakeAgentProvider([[]]);
    const executor = { execute: jest.fn() } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([patchFixture]);

    expect(report.cases[0]).toMatchObject({
      error: 'PROVIDER_PROTOCOL_ERROR',
      routingPass: false,
    });
  });

  it('requires every patch call to have a matching Rust-valid result', async () => {
    const provider = new FakeAgentProvider([
      [
        patchCall('call-1'),
        patchCall('call-2'),
        usage(100),
        { type: 'completed', finishReason: 'tool' },
      ],
      [usage(50, 5), { type: 'completed', finishReason: 'stop' }],
    ]);
    const executor = {
      execute: jest.fn().mockImplementation(({ callId }: { callId: string }) =>
        Promise.resolve(
          callId === 'call-1'
            ? validPatchResult(callId)
            : {
                ok: false,
                tool: 'apply_json_patch',
                callId,
                error: { code: 'RUST_REJECTED', message: 'Invalid patch.' },
              },
        ),
      ),
    } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([patchFixture]);

    expect(report.cases[0]).toMatchObject({
      patchProposalValid: false,
      patchProposalCount: 2,
      validPatchProposalCount: 1,
    });
    expect(report.summary.thresholds.patchProposalValidity).toBe(false);
  });

  it('fails closed when a completed model round has no usage evidence', async () => {
    const provider = new FakeAgentProvider([
      [patchCall('call-1'), { type: 'completed', finishReason: 'tool' }],
      [{ type: 'completed', finishReason: 'stop' }],
    ]);
    const executor = {
      execute: jest.fn().mockResolvedValue(validPatchResult('call-1')),
    } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([patchFixture]);

    expect(report.cases[0]).toMatchObject({
      error: 'missing_usage',
      usageEvidenceValid: false,
      estimatedCostMicroUsd: null,
    });
    expect(report.summary.thresholds.usageEvidence).toBe(false);
  });

  it('does not let duplicate usage in one round mask missing usage in another', async () => {
    const provider = new FakeAgentProvider([
      [
        patchCall('call-1'),
        usage(100),
        usage(20, 2),
        { type: 'completed', finishReason: 'tool' },
      ],
      [{ type: 'completed', finishReason: 'stop' }],
    ]);
    const executor = {
      execute: jest.fn().mockResolvedValue(validPatchResult('call-1')),
    } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([patchFixture]);

    expect(report.cases[0]).toMatchObject({
      error: 'missing_usage',
      usageEvidenceValid: false,
      completedRounds: 2,
      usageRecords: 2,
      estimatedCostMicroUsd: null,
    });
    expect(report.summary.thresholds.usageEvidence).toBe(false);
  });

  it('treats output truncation as an automatic failure', async () => {
    const provider = new FakeAgentProvider([
      [usage(20, 700), { type: 'completed', finishReason: 'length' }],
    ]);
    const executor = { execute: jest.fn() } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([clarifyFixture]);

    expect(report.cases[0]).toMatchObject({
      error: 'output_limit',
      routingPass: false,
      usageEvidenceValid: true,
    });
  });

  it('measures three-turn sessions with prior visible conversation context', async () => {
    const provider = new SequentialTurnProvider([
      completedTextRound('First response.', 100),
      completedTextRound('Second response.', 200),
      completedTextRound('Third response.', 300),
    ]);
    const executor = { execute: jest.fn() } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([clarifyFixture, clarifyFixture, clarifyFixture], {
      turnsPerSession: 3,
    });

    expect(report.sessions).toEqual([
      {
        id: 'session-1',
        caseIds: ['clarify-eval', 'clarify-eval', 'clarify-eval'],
        turns: 3,
        usageEvidenceValid: true,
        estimatedCostMicroUsd: 156,
      },
    ]);
    expect(report.sessionCost).toEqual({
      sessions: 1,
      p95SessionCostMicroUsd: 156,
      belowThirtyMilliUsd: true,
    });
    expect(provider.requests[1].visibleMessages[0].content).toContain(
      'First response.',
    );
    expect(provider.requests[2].visibleMessages[0].content).toContain(
      'Second response.',
    );
  });

  it('stops before another paid case after a configured systemic error', async () => {
    const provider = new FakeAgentProvider([
      [
        {
          type: 'provider_error',
          retryable: false,
          code: 'insufficient_quota',
          safeMessage: 'Quota exhausted.',
        },
      ],
    ]);
    const executor = { execute: jest.fn() } as unknown as AgentToolExecutor;
    const report = await new RoutingEvalRunner(
      provider,
      new AgentTurnOrchestrator(executor),
      'gpt-5.6-luna',
    ).run([patchFixture, patchFixture], {
      turnsPerSession: 3,
      stopOnError: (error) => error === 'insufficient_quota',
    });

    expect(report).toMatchObject({
      fatalError: 'insufficient_quota',
      cases: [{ error: 'insufficient_quota' }],
    });
    expect(provider.requests).toHaveLength(1);
    expect(report.sessionCost).toMatchObject({
      p95SessionCostMicroUsd: null,
      belowThirtyMilliUsd: null,
    });
  });
});

const patchFixture: RoutingFixture = {
  id: 'patch-eval',
  category: 'patch',
  selectedTool: 'patch',
  instruction: 'Set enabled to true.',
  context: { document: '{"enabled":false}' },
  expected: { decision: 'tool', tool: 'apply_json_patch' },
};

const clarifyFixture: RoutingFixture = {
  id: 'clarify-eval',
  category: 'ambiguous',
  selectedTool: 'pointer',
  instruction: 'Find the value.',
  context: { document: '{"first":1,"second":2}' },
  expected: { decision: 'clarify' },
};

function patchCall(callId: string) {
  return {
    type: 'tool_call_complete' as const,
    callId,
    tool: 'apply_json_patch' as const,
    argumentsJson:
      '{"document":"{\\"enabled\\":false}","patch":"[{\\"op\\":\\"replace\\",\\"path\\":\\"/enabled\\",\\"value\\":true}]"}',
  };
}

function validPatchResult(callId: string) {
  return {
    ok: true as const,
    tool: 'apply_json_patch' as const,
    callId,
    data: {
      operations: [{ op: 'replace', path: '/enabled', value: true }],
      output: '{"enabled":true}',
      summary: { operations: 1, added: 0, removed: 0, replaced: 1 },
    },
    validation: { engine: 'jason' as const, valid: true as const },
  };
}

function usage(inputTokens: number, outputTokens = 10) {
  return {
    type: 'usage' as const,
    inputTokens,
    outputTokens,
    cachedInputTokens: 0,
  };
}

function completedTextRound(text: string, inputTokens: number) {
  return [
    { type: 'text_delta' as const, text },
    usage(inputTokens),
    { type: 'completed' as const, finishReason: 'stop' as const },
  ];
}

class SequentialTurnProvider implements AgentProvider {
  readonly id = 'openai' as const;
  readonly capabilities = {
    streaming: true,
    strictTools: true,
    lowReasoningProfile: true,
    statelessMode: true,
  } as const;
  readonly requests: ProviderTurnRequest[] = [];

  constructor(private readonly rounds: ProviderEvent[][]) {}

  createTurn(request: ProviderTurnRequest): Promise<AgentProviderTurn> {
    this.requests.push(request);
    const events = this.rounds.shift() ?? [];
    return Promise.resolve({
      async *streamRound(
        _toolResults: readonly NormalizedToolResult[],
      ): AsyncIterable<ProviderEvent> {
        await Promise.resolve();
        void _toolResults;
        for (const event of events) yield event;
      },
      close: () => Promise.resolve(),
    });
  }
}
