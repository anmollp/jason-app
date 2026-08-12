import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AgentAuditLogger } from './agent-audit.logger';
import { AgentClock } from './agent-clock';
import { estimateLunaCostMicroUsd } from './agent-cost';
import { type AgentConfig } from './agent.config';
import {
  AgentError,
  normalizePublicError,
  type PublicAgentErrorEvent,
} from './agent.errors';
import {
  AGENT_VISITOR_COOKIE,
  AgentIdentityService,
  readCookie,
  utcDateKey,
  utcMonthKey,
} from './agent-identity.service';
import { AgentProviderRegistry } from './agent-provider.registry';
import { AgentStateRepository } from './agent-state.repository';
import { AgentTurnOrchestrator } from './agent-turn-orchestrator.service';
import { AGENT_SYSTEM_INSTRUCTION } from './agent.prompt';
import { AGENT_CONFIG } from './agent.tokens';
import type {
  AgentMessageRequest,
  AgentPublicEvent,
  AgentSelectedTool,
  AgentSessionResponse,
} from './contracts/http-contracts';
import type { AgentTurnEvent } from './contracts/provider-contracts';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_VERSION,
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
  type AgentToolName,
} from './contracts/tool-contracts';
import { InstructionModerator } from './instruction-moderator';

export type IssuedAgentSession = {
  response: AgentSessionResponse;
  setCookie?: string;
};

type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

const ACCOUNTING_TIMEOUT_MILLIS = 5_000;

@Injectable()
export class AgentSessionService {
  constructor(
    @Inject(AGENT_CONFIG)
    private readonly config: AgentConfig,
    private readonly identity: AgentIdentityService,
    private readonly state: AgentStateRepository,
    private readonly moderator: InstructionModerator,
    private readonly providers: AgentProviderRegistry,
    private readonly orchestrator: AgentTurnOrchestrator,
    private readonly audit: AgentAuditLogger,
    private readonly clock: AgentClock,
  ) {}

  async issueSession(
    cookieHeader: string | undefined,
    clientIp: string,
  ): Promise<IssuedAgentSession> {
    const config = this.requireEnabled();
    const startedAt = this.clock.now();
    const existing = this.identity.verifyVisitorToken(
      readCookie(cookieHeader, AGENT_VISITOR_COOKIE),
    );
    const visitorToken = existing ?? this.identity.issueVisitorToken();
    const anonymousIdentity = this.identity.deriveIdentity(
      visitorToken,
      clientIp,
      startedAt,
    );
    const sessionId = randomBytes(24).toString('base64url');
    const sessionHash = this.identity.deriveSafetyIdentifier(sessionId);
    const expiresAt = new Date(startedAt.getTime() + 86_400_000);
    const yesterday = new Date(startedAt.getTime() - 86_400_000);
    const session = await this.state.issueSession({
      sessionId,
      sessionHash,
      identity: anonymousIdentity,
      nowMillis: startedAt.getTime(),
      expiresAtMillis: expiresAt.getTime(),
      todayKey: utcDateKey(startedAt),
      yesterdayKey: utcDateKey(yesterday),
      monthKey: utcMonthKey(startedAt),
      provider: config.provider,
      model: config.model,
    });

    this.audit.write({
      event: 'session',
      sessionHash,
      provider: config.provider,
      model: config.model,
      latencyMs: this.clock.now().getTime() - startedAt.getTime(),
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      estimatedCostMicroUsd: 0,
      outcome: 'issued',
    });

    return {
      response: {
        sessionId,
        expiresAt: expiresAt.toISOString(),
        remainingTurns:
          AGENT_RUNTIME_LIMITS.userTurnsPerSession - session.turnsUsed,
        remainingToolCalls:
          AGENT_RUNTIME_LIMITS.toolCallsPerSession - session.toolCallsUsed,
      },
      setCookie: existing
        ? undefined
        : this.identity.serializeCookie(visitorToken),
    };
  }

  async *streamMessage(
    request: AgentMessageRequest,
    disconnectSignal?: AbortSignal,
  ): AsyncIterable<AgentPublicEvent> {
    const config = this.requireEnabled();
    const startedAt = this.clock.now();
    const requestId = randomBytes(16).toString('base64url');
    const sessionHash = this.identity.deriveSafetyIdentifier(request.sessionId);
    const usage: UsageTotals = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    };
    let outcome = 'failed';
    let remainingTurns = 0;
    let remainingToolCalls = 0;
    let publicError: PublicAgentErrorEvent | undefined;
    let accepted = false;
    const timeout = new AbortController();
    const timeoutId = setTimeout(
      () =>
        timeout.abort(
          new AgentError('REQUEST_TIMEOUT', 'The AI request timed out.', true),
        ),
      AGENT_RUNTIME_LIMITS.requestTimeoutSeconds * 1_000,
    );
    const signal = disconnectSignal
      ? AbortSignal.any([timeout.signal, disconnectSignal])
      : timeout.signal;

    try {
      const reservation = await abortable(
        this.state.reserveTurn({
          sessionId: request.sessionId,
          requestId,
          selectedTool: request.selectedTool,
          nowMillis: startedAt.getTime(),
          leaseExpiresAtMillis: startedAt.getTime() + 65_000,
        }),
        signal,
      );
      accepted = true;
      remainingTurns =
        AGENT_RUNTIME_LIMITS.userTurnsPerSession - reservation.turnsUsed;
      remainingToolCalls =
        AGENT_RUNTIME_LIMITS.toolCallsPerSession - reservation.toolCallsUsed;

      yield {
        type: 'status',
        phase: 'moderating',
        message: 'Checking the instruction.',
      };
      await abortable(
        this.moderator.assertAllowed(request.instruction, signal),
        signal,
      );
      yield {
        type: 'status',
        phase: 'thinking',
        message: 'Jason is preparing a safe result.',
      };

      const provider = this.providers.getProvider();
      const providerRequest = {
        contractVersion: AGENT_CONTRACT_VERSION,
        promptVersion: AGENT_PROMPT_VERSION,
        systemInstruction: AGENT_SYSTEM_INSTRUCTION,
        visibleMessages: [
          {
            role: 'user' as const,
            content: serializeUntrustedRequest(request),
          },
        ],
        tools: AGENT_TOOL_DEFINITIONS,
        limits: {
          maxRoundTrips: 2 as const,
          maxToolCalls: 2 as const,
          maxOutputTokens: 700 as const,
          reasoningProfile: 'low' as const,
          latencyTier: 'standard' as const,
        },
        privacy: {
          retainProviderState: false as const,
          abuseIdentifier: sessionHash,
        },
      };

      for await (const event of this.orchestrator.streamTurn(
        provider,
        providerRequest,
        signal,
        {
          beforeToolCall: async () => {
            const state = await abortable(
              this.state.reserveToolCall(
                request.sessionId,
                requestId,
                this.clock.now().getTime(),
              ),
              signal,
            );
            remainingToolCalls =
              AGENT_RUNTIME_LIMITS.toolCallsPerSession - state.toolCallsUsed;
          },
        },
      )) {
        const mapped = mapTurnEvent(event, usage);
        for (const item of mapped) {
          if (item.type === 'error') {
            outcome = item.code;
          }
          yield item;
        }
      }
      if (outcome === 'failed') {
        outcome = 'completed';
      }
    } catch (error) {
      const normalized = normalizePublicError(error);
      outcome = normalized.code;
      publicError = normalized;
    } finally {
      const finishedAt = this.clock.now();
      const cost = estimateLunaCostMicroUsd(usage);
      try {
        if (accepted) {
          const accounting = new AbortController();
          const accountingTimeoutId = setTimeout(
            () => accounting.abort(),
            ACCOUNTING_TIMEOUT_MILLIS,
          );
          try {
            await abortable(
              this.state.completeRequest({
                sessionId: request.sessionId,
                requestId,
                ...usage,
                actualCostMicroUsd: cost,
                latencyMs: finishedAt.getTime() - startedAt.getTime(),
                outcome,
              }),
              accounting.signal,
            );
          } finally {
            clearTimeout(accountingTimeoutId);
          }
        }
      } catch {
        publicError = {
          type: 'error',
          code: 'state_unavailable',
          message: 'AI session accounting is temporarily unavailable.',
          retryable: true,
        };
        outcome = 'state_unavailable';
      }
      this.audit.write({
        event: 'message',
        sessionHash,
        tool: request.selectedTool,
        provider: config.provider,
        model: config.model,
        latencyMs: finishedAt.getTime() - startedAt.getTime(),
        ...usage,
        estimatedCostMicroUsd: cost,
        outcome,
      });
      clearTimeout(timeoutId);
    }

    if (publicError) {
      yield publicError;
    }
    if (accepted) {
      yield {
        type: 'usage',
        ...usage,
        estimatedCostMicroUsd: estimateLunaCostMicroUsd(usage),
        remainingTurns,
        remainingToolCalls,
      };
    }
    yield { type: 'done' };
  }

  private requireEnabled(): Extract<AgentConfig, { enabled: true }> {
    if (!this.config.enabled) {
      throw new AgentError('FEATURE_DISABLED', 'The AI copilot is disabled.');
    }
    return this.config;
  }
}

function serializeUntrustedRequest(request: AgentMessageRequest): string {
  return JSON.stringify({
    selectedTool: request.selectedTool,
    instruction: request.instruction,
    context: request.context,
    visibleMessages: request.visibleMessages,
  });
}

function mapTurnEvent(
  event: AgentTurnEvent,
  usage: UsageTotals,
): AgentPublicEvent[] {
  switch (event.type) {
    case 'turn_started':
      return [];
    case 'text_delta':
      return [{ type: 'message', delta: event.text }];
    case 'tool_call_started':
      return [];
    case 'tool_call_complete':
      return [{ type: 'tool_call', tool: event.tool }];
    case 'tool_result':
      return [
        {
          type: 'tool_result',
          tool: event.result.tool,
          ok: event.result.ok,
          ...(event.result.ok ? { validation: 'jason' } : {}),
        },
        ...(event.result.ok
          ? ([
              {
                type: 'proposal',
                tool: selectedToolFor(event.result.tool),
                data: event.result.data,
                validation: 'jason',
              },
            ] satisfies AgentPublicEvent[])
          : []),
      ];
    case 'usage':
      usage.inputTokens += event.inputTokens;
      usage.outputTokens += event.outputTokens;
      usage.cachedInputTokens += event.cachedInputTokens ?? 0;
      return [];
    case 'completed':
      return event.finishReason === 'length'
        ? [
            {
              type: 'error',
              code: 'output_limit',
              message: 'The response reached its safe output limit.',
              retryable: false,
            },
          ]
        : [];
    case 'provider_error':
      return [normalizeProviderError(event.code, event.retryable)];
  }
}

function selectedToolFor(tool: AgentToolName): AgentSelectedTool {
  switch (tool) {
    case 'format_json':
      return 'formatter';
    case 'diff_json':
      return 'diff';
    case 'apply_json_patch':
      return 'patch';
    case 'resolve_json_pointer':
      return 'pointer';
    default:
      throw new AgentError(
        'UNKNOWN_TOOL',
        'The provider requested an unavailable tool.',
      );
  }
}

function normalizeProviderError(
  code: string,
  retryable: boolean,
): PublicAgentErrorEvent {
  if (
    code === 'project_spend_limit_exceeded' ||
    code === 'organization_spend_limit_exceeded' ||
    code === 'billing_hard_limit_reached' ||
    code === 'usage_limit_reached' ||
    code === 'insufficient_quota'
  ) {
    return {
      type: 'error',
      code: 'budget_exhausted',
      message: 'The monthly AI budget is exhausted.',
      retryable: false,
    };
  }
  return {
    type: 'error',
    code: 'provider_unavailable',
    message: 'The model provider is temporarily unavailable.',
    retryable,
  };
}

async function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    throw abortReason(signal);
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortReason(signal));
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new AgentError('REQUEST_TIMEOUT', 'The AI request timed out.', true);
}
