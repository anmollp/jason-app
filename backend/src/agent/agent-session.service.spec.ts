import type { AgentAuditLogger } from './agent-audit.logger';
import { AgentClock } from './agent-clock';
import { AgentIdentityService } from './agent-identity.service';
import type { AgentProviderRegistry } from './agent-provider.registry';
import { AgentSessionService } from './agent-session.service';
import {
  AgentStateRepository,
  type CompleteRequestInput,
  type IssueSessionInput,
  type ReserveTurnInput,
  type SessionSnapshot,
} from './agent-state.repository';
import type { AgentToolExecutor } from './agent-tool-executor.service';
import { AgentTurnOrchestrator } from './agent-turn-orchestrator.service';
import type {
  AgentMessageRequest,
  AgentPublicEvent,
} from './contracts/http-contracts';
import { InstructionModerator } from './instruction-moderator';
import { FakeAgentProvider } from './providers/fake-agent.provider';
import { readAgentConfig } from './agent.config';
import { AgentError } from './agent.errors';

describe('AgentSessionService', () => {
  it('streams the approved event surface and accounts the completed request', async () => {
    const provider = new FakeAgentProvider([
      [
        {
          type: 'tool_call_complete',
          callId: 'call-1',
          tool: 'format_json',
          argumentsJson: '{"input":"{}"}',
        },
        { type: 'completed', finishReason: 'tool' },
      ],
      [
        { type: 'text_delta', text: 'Formatted and validated.' },
        {
          type: 'usage',
          inputTokens: 120,
          outputTokens: 20,
          cachedInputTokens: 10,
        },
        { type: 'completed', finishReason: 'stop' },
      ],
    ]);
    const harness = createHarness(provider);
    const events = await collect(harness.service.streamMessage(messageRequest));

    expect(events.map((event) => event.type)).toEqual([
      'status',
      'status',
      'tool_call',
      'tool_result',
      'proposal',
      'message',
      'usage',
      'done',
    ]);
    expect(harness.moderator.instructions).toEqual([
      messageRequest.instruction,
    ]);
    expect(provider.requests[0].privacy.retainProviderState).toBe(false);
    expect(provider.requests[0].privacy.abuseIdentifier).toMatch(/^aj_/);
    expect(provider.requests[0].visibleMessages.at(-1)?.content).toContain(
      '"selectedTool":"formatter"',
    );
    expect(provider.requests[0].visibleMessages).toHaveLength(1);
    expect(provider.requests[0].visibleMessages[0].role).toBe('user');
    expect(provider.requests[0].visibleMessages[0].content).toContain(
      'Prior safe summary.',
    );
    expect(harness.state.completeInputs).toHaveLength(1);
    expect(harness.state.completeInputs[0]).toMatchObject({
      inputTokens: 120,
      outputTokens: 20,
      cachedInputTokens: 10,
      outcome: 'completed',
    });
  });

  it('consumes an accepted turn when moderation blocks the instruction', async () => {
    const harness = createHarness(new FakeAgentProvider([]));
    harness.moderator.error = new AgentError(
      'MODERATION_BLOCKED',
      'The instruction could not be processed safely.',
    );

    const events = await collect(harness.service.streamMessage(messageRequest));

    expect(harness.state.turnsUsed).toBe(1);
    expect(harness.state.completeInputs).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'error', code: 'moderation_blocked' }),
    );
    expect(harness.getProvider).not.toHaveBeenCalled();
  });

  it('maps provider spend-limit failures to a safe budget error', async () => {
    const harness = createHarness(
      new FakeAgentProvider([
        [
          {
            type: 'provider_error',
            code: 'project_spend_limit_exceeded',
            safeMessage: 'provider detail',
            retryable: false,
          },
        ],
      ]),
    );

    const events = await collect(harness.service.streamMessage(messageRequest));

    expect(events).toContainEqual({
      type: 'error',
      code: 'budget_exhausted',
      message: 'The monthly AI budget is exhausted.',
      retryable: false,
    });
    expect(JSON.stringify(events)).not.toContain('provider detail');
  });

  it('fails closed without contacting moderation or the provider when state is unavailable', async () => {
    const harness = createHarness(new FakeAgentProvider([]));
    harness.state.reserveError = new Error('firestore credential detail');

    const events = await collect(harness.service.streamMessage(messageRequest));

    expect(events).toEqual([
      {
        type: 'error',
        code: 'agent_unavailable',
        message: 'The AI copilot is temporarily unavailable.',
        retryable: true,
      },
      { type: 'done' },
    ]);
    expect(harness.moderator.instructions).toHaveLength(0);
    expect(harness.getProvider).not.toHaveBeenCalled();
    expect(JSON.stringify(events)).not.toContain('firestore credential detail');
  });

  it('aborts a stalled moderation request at 60 seconds and releases accounting', async () => {
    jest.useFakeTimers();
    try {
      const harness = createHarness(new FakeAgentProvider([]));
      harness.moderator.waitForAbort = true;
      const collection = collect(harness.service.streamMessage(messageRequest));

      await jest.advanceTimersByTimeAsync(60_000);
      const events = await collection;

      expect(events).toContainEqual(
        expect.objectContaining({ type: 'error', code: 'request_timeout' }),
      );
      expect(harness.state.completeInputs).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('awaits final accounting after the request signal is aborted', async () => {
    const harness = createHarness(new FakeAgentProvider([]));
    harness.moderator.waitForAbort = true;
    let releaseAccounting: () => void = () => undefined;
    harness.state.completeWait = new Promise<void>((resolve) => {
      releaseAccounting = resolve;
    });
    const disconnect = new AbortController();
    const collection = collect(
      harness.service.streamMessage(messageRequest, disconnect.signal),
    );

    await new Promise<void>((resolve) => setImmediate(resolve));
    disconnect.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));

    let settled = false;
    void collection.then(() => {
      settled = true;
    });
    expect(harness.state.completeInputs).toHaveLength(1);
    expect(settled).toBe(false);

    releaseAccounting();
    await collection;
    expect(settled).toBe(true);
  });

  it('bounds final accounting to five seconds', async () => {
    jest.useFakeTimers();
    try {
      const harness = createHarness(new FakeAgentProvider([]));
      harness.moderator.error = new AgentError(
        'MODERATION_BLOCKED',
        'The instruction could not be processed safely.',
      );
      harness.state.completeWait = new Promise<void>(() => undefined);
      const collection = collect(harness.service.streamMessage(messageRequest));

      await jest.advanceTimersByTimeAsync(5_000);
      const events = await collection;

      expect(events).toContainEqual(
        expect.objectContaining({ type: 'error', code: 'state_unavailable' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('applies the 60-second deadline while reserving Firestore state', async () => {
    jest.useFakeTimers();
    try {
      const harness = createHarness(new FakeAgentProvider([]));
      harness.state.reserveNever = true;
      const collection = collect(harness.service.streamMessage(messageRequest));

      await jest.advanceTimersByTimeAsync(60_000);
      const events = await collection;

      expect(events).toEqual([
        expect.objectContaining({ type: 'error', code: 'request_timeout' }),
        { type: 'done' },
      ]);
      expect(harness.state.completeInputs).toHaveLength(0);
      expect(harness.moderator.instructions).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

const messageRequest: AgentMessageRequest = {
  sessionId: 's'.repeat(32),
  selectedTool: 'formatter',
  instruction: 'Format the selected JSON.',
  context: { input: '{}' },
  visibleMessages: [{ role: 'assistant', content: 'Prior safe summary.' }],
};

function createHarness(provider: FakeAgentProvider) {
  const config = readAgentConfig({
    AI_ENABLED: 'true',
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-5.6-luna',
    OPENAI_API_KEY: 'test-key',
    AI_IDENTITY_KEY: Buffer.alloc(32, 4).toString('base64'),
  });
  if (!config.enabled) {
    throw new Error('test configuration must be enabled');
  }
  const state = new MemoryStateRepository();
  const moderator = new TestModerator();
  const getProvider = jest.fn(() => provider);
  const registry = {
    getProvider,
  } as unknown as AgentProviderRegistry;
  const executor = {
    execute: jest.fn().mockResolvedValue({
      ok: true,
      tool: 'format_json',
      callId: 'call-1',
      data: { output: '{\n}' },
      validation: { engine: 'jason', valid: true },
    }),
  } as unknown as AgentToolExecutor;
  const audit = { write: jest.fn() } as unknown as AgentAuditLogger;
  const service = new AgentSessionService(
    config,
    new AgentIdentityService(config.identityKey, true),
    state,
    moderator,
    registry,
    new AgentTurnOrchestrator(executor),
    audit,
    new AgentClock(),
  );
  return { service, state, moderator, getProvider };
}

class TestModerator extends InstructionModerator {
  instructions: string[] = [];
  error?: Error;
  waitForAbort = false;

  async assertAllowed(instruction: string, signal: AbortSignal): Promise<void> {
    this.instructions.push(instruction);
    if (this.error) {
      throw this.error;
    }
    if (this.waitForAbort) {
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason as Error), {
          once: true,
        });
      });
    }
  }
}

class MemoryStateRepository extends AgentStateRepository {
  turnsUsed = 0;
  toolCallsUsed = 0;
  completeInputs: CompleteRequestInput[] = [];
  reserveError?: Error;
  reserveNever = false;
  completeWait?: Promise<void>;

  issueSession(_input: IssueSessionInput): Promise<SessionSnapshot> {
    void _input;
    return Promise.resolve(this.snapshot());
  }

  reserveTurn(_input: ReserveTurnInput): Promise<SessionSnapshot> {
    void _input;
    if (this.reserveError) {
      return Promise.reject(this.reserveError);
    }
    if (this.reserveNever) {
      return new Promise<SessionSnapshot>(() => undefined);
    }
    this.turnsUsed += 1;
    return Promise.resolve(this.snapshot());
  }

  reserveToolCall(
    _sessionId: string,
    _requestId: string,
    _nowMillis: number,
  ): Promise<SessionSnapshot> {
    void _sessionId;
    void _requestId;
    void _nowMillis;
    this.toolCallsUsed += 1;
    return Promise.resolve(this.snapshot());
  }

  completeRequest(input: CompleteRequestInput): Promise<void> {
    this.completeInputs.push(input);
    return this.completeWait ?? Promise.resolve();
  }

  private snapshot(): SessionSnapshot {
    return {
      sessionId: messageRequest.sessionId,
      expiresAtMillis: Date.now() + 86_400_000,
      turnsUsed: this.turnsUsed,
      toolCallsUsed: this.toolCallsUsed,
    };
  }
}

async function collect(
  events: AsyncIterable<AgentPublicEvent>,
): Promise<AgentPublicEvent[]> {
  const result: AgentPublicEvent[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}
