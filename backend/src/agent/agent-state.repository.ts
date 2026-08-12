import type { AnonymousIdentity } from './agent-identity.service';

export const SESSION_RESERVATION_MICRO_USD = 30_000;
export const LOCAL_MONTHLY_LIMIT_MICRO_USD = 7_200_000;
export const DAILY_SESSION_LIMIT = 20;
export const MONTHLY_SESSION_LIMIT = 200;

export type AgentQuotaPolicy = {
  dailySessionLimit: 10 | 20;
  monthlySessionLimit: 200;
};

export const DEFAULT_AGENT_QUOTA_POLICY: AgentQuotaPolicy = {
  dailySessionLimit: DAILY_SESSION_LIMIT,
  monthlySessionLimit: MONTHLY_SESSION_LIMIT,
};

export type SessionSnapshot = {
  sessionId: string;
  expiresAtMillis: number;
  turnsUsed: number;
  toolCallsUsed: number;
};

export type IssueSessionInput = {
  sessionId: string;
  sessionHash: string;
  identity: AnonymousIdentity;
  nowMillis: number;
  expiresAtMillis: number;
  todayKey: string;
  yesterdayKey: string;
  monthKey: string;
  provider: string;
  model: string;
};

export type ReserveTurnInput = {
  sessionId: string;
  requestId: string;
  selectedTool: string;
  nowMillis: number;
  leaseExpiresAtMillis: number;
};

export type CompleteRequestInput = {
  sessionId: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  actualCostMicroUsd: number;
  latencyMs: number;
  outcome: string;
};

export abstract class AgentStateRepository {
  abstract issueSession(input: IssueSessionInput): Promise<SessionSnapshot>;
  abstract reserveTurn(input: ReserveTurnInput): Promise<SessionSnapshot>;
  abstract reserveToolCall(
    sessionId: string,
    requestId: string,
    nowMillis: number,
  ): Promise<SessionSnapshot>;
  abstract completeRequest(input: CompleteRequestInput): Promise<void>;
}
