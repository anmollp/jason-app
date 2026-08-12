import { Injectable } from '@nestjs/common';
import {
  FieldValue,
  Firestore,
  type DocumentData,
} from '@google-cloud/firestore';
import { AgentError } from './agent.errors';
import { AGENT_RUNTIME_LIMITS } from './contracts/tool-contracts';
import {
  AgentStateRepository,
  DEFAULT_AGENT_QUOTA_POLICY,
  LOCAL_MONTHLY_LIMIT_MICRO_USD,
  SESSION_RESERVATION_MICRO_USD,
  type CompleteRequestInput,
  type AgentQuotaPolicy,
  type IssueSessionInput,
  type ReserveTurnInput,
  type SessionSnapshot,
} from './agent-state.repository';

type DayLedger = {
  sessionCount?: number;
  visitorGuards?: Record<string, number>;
  ipGuards?: Record<string, number>;
};

type MonthLedger = {
  sessionCount?: number;
  reservedMicroUsd?: number;
  actualMicroUsd?: number;
};

type StoredSession = {
  expiresAtMillis: number;
  monthKey: string;
  turnsUsed?: number;
  toolCallsUsed?: number;
  activeRequestId?: string | null;
  leaseExpiresAtMillis?: number | null;
  requestToolCalls?: number;
};

@Injectable()
export class FirestoreAgentStateRepository extends AgentStateRepository {
  constructor(
    private readonly firestore: Firestore,
    private readonly quotaPolicy: AgentQuotaPolicy = DEFAULT_AGENT_QUOTA_POLICY,
  ) {
    super();
  }

  async issueSession(input: IssueSessionInput): Promise<SessionSnapshot> {
    await this.cleanupExpiredRecords(input.nowMillis);

    return this.firestore.runTransaction(async (transaction) => {
      const todayRef = this.firestore.doc(`quotaDays/${input.todayKey}`);
      const yesterdayRef = this.firestore.doc(
        `quotaDays/${input.yesterdayKey}`,
      );
      const monthRef = this.firestore.doc(`quotaMonths/${input.monthKey}`);
      const sessionRef = this.firestore.doc(`sessions/${input.sessionId}`);
      const [todayDoc, yesterdayDoc, monthDoc, sessionDoc] = await Promise.all([
        transaction.get(todayRef),
        transaction.get(yesterdayRef),
        transaction.get(monthRef),
        transaction.get(sessionRef),
      ]);

      if (sessionDoc.exists) {
        throw new AgentError('INVALID_IDENTITY', 'Session identity collision.');
      }

      const today = (todayDoc.data() ?? {}) as DayLedger;
      const yesterday = (yesterdayDoc.data() ?? {}) as DayLedger;
      const month = (monthDoc.data() ?? {}) as MonthLedger;
      if (
        hasActiveGuard(
          today.visitorGuards,
          input.identity.visitorHash,
          input.nowMillis,
        ) ||
        hasActiveGuard(
          yesterday.visitorGuards,
          input.identity.visitorHash,
          input.nowMillis,
        ) ||
        hasActiveGuard(
          today.ipGuards,
          input.identity.ipHashToday,
          input.nowMillis,
        ) ||
        hasActiveGuard(
          yesterday.ipGuards,
          input.identity.ipHashYesterday,
          input.nowMillis,
        )
      ) {
        throw new AgentError(
          'QUOTA_EXHAUSTED',
          'This visitor or network has already used its guided session.',
        );
      }

      if ((today.sessionCount ?? 0) >= this.quotaPolicy.dailySessionLimit) {
        throw new AgentError(
          'QUOTA_EXHAUSTED',
          'The daily guided-session quota is exhausted.',
        );
      }
      if ((month.sessionCount ?? 0) >= this.quotaPolicy.monthlySessionLimit) {
        throw new AgentError(
          'QUOTA_EXHAUSTED',
          'The monthly guided-session quota is exhausted.',
        );
      }
      if (
        (month.reservedMicroUsd ?? 0) + SESSION_RESERVATION_MICRO_USD >
        LOCAL_MONTHLY_LIMIT_MICRO_USD
      ) {
        throw new AgentError(
          'BUDGET_EXHAUSTED',
          'The local monthly AI budget is exhausted.',
        );
      }

      transaction.set(
        todayRef,
        {
          sessionCount: (today.sessionCount ?? 0) + 1,
          visitorGuards: {
            ...(today.visitorGuards ?? {}),
            [input.identity.visitorHash]: input.expiresAtMillis,
          },
          ipGuards: {
            ...(today.ipGuards ?? {}),
            [input.identity.ipHashToday]: input.expiresAtMillis,
          },
          updatedAtMillis: input.nowMillis,
        },
        { merge: true },
      );
      transaction.set(
        monthRef,
        {
          sessionCount: (month.sessionCount ?? 0) + 1,
          reservedMicroUsd:
            (month.reservedMicroUsd ?? 0) + SESSION_RESERVATION_MICRO_USD,
          actualMicroUsd: month.actualMicroUsd ?? 0,
          updatedAtMillis: input.nowMillis,
        },
        { merge: true },
      );
      transaction.create(sessionRef, {
        sessionHash: input.sessionHash,
        createdAtMillis: input.nowMillis,
        expiresAtMillis: input.expiresAtMillis,
        monthKey: input.monthKey,
        turnsUsed: 0,
        toolCallsUsed: 0,
        activeRequestId: null,
        leaseExpiresAtMillis: null,
        requestToolCalls: 0,
        provider: input.provider,
        model: input.model,
        reservedMicroUsd: SESSION_RESERVATION_MICRO_USD,
        actualMicroUsd: 0,
        outcome: 'issued',
      });

      return snapshot(input.sessionId, {
        expiresAtMillis: input.expiresAtMillis,
        turnsUsed: 0,
        toolCallsUsed: 0,
      });
    });
  }

  reserveTurn(input: ReserveTurnInput): Promise<SessionSnapshot> {
    return this.firestore.runTransaction(async (transaction) => {
      const ref = this.firestore.doc(`sessions/${input.sessionId}`);
      const document = await transaction.get(ref);
      const session = requireSession(document.data());
      if (session.expiresAtMillis <= input.nowMillis) {
        throw new AgentError(
          'SESSION_EXPIRED',
          'The guided session has expired.',
        );
      }
      if (
        (session.turnsUsed ?? 0) >= AGENT_RUNTIME_LIMITS.userTurnsPerSession
      ) {
        throw new AgentError(
          'TURN_LIMIT_EXCEEDED',
          'The guided session has no turns remaining.',
        );
      }
      if (
        session.activeRequestId &&
        (session.leaseExpiresAtMillis ?? 0) > input.nowMillis
      ) {
        throw new AgentError(
          'CONCURRENT_REQUEST',
          'Another request is already active for this session.',
          true,
        );
      }

      const turnsUsed = (session.turnsUsed ?? 0) + 1;
      transaction.update(ref, {
        turnsUsed,
        activeRequestId: input.requestId,
        leaseExpiresAtMillis: input.leaseExpiresAtMillis,
        requestToolCalls: 0,
        selectedTool: input.selectedTool,
        outcome: 'accepted',
      });
      return snapshot(input.sessionId, { ...session, turnsUsed });
    });
  }

  reserveToolCall(
    sessionId: string,
    requestId: string,
    nowMillis: number,
  ): Promise<SessionSnapshot> {
    return this.firestore.runTransaction(async (transaction) => {
      const ref = this.firestore.doc(`sessions/${sessionId}`);
      const document = await transaction.get(ref);
      const session = requireSession(document.data());
      if (
        session.activeRequestId !== requestId ||
        (session.leaseExpiresAtMillis ?? 0) <= nowMillis
      ) {
        throw new AgentError(
          'CONCURRENT_REQUEST',
          'The request lease is no longer active.',
        );
      }
      if (
        (session.requestToolCalls ?? 0) >= AGENT_RUNTIME_LIMITS.toolCallsPerTurn
      ) {
        throw new AgentError(
          'TOOL_LIMIT_EXCEEDED',
          'The provider exceeded the tool-call limit for this turn.',
        );
      }
      if (
        (session.toolCallsUsed ?? 0) >= AGENT_RUNTIME_LIMITS.toolCallsPerSession
      ) {
        throw new AgentError(
          'SESSION_TOOL_LIMIT_EXCEEDED',
          'The session has no tool calls remaining.',
        );
      }

      const toolCallsUsed = (session.toolCallsUsed ?? 0) + 1;
      transaction.update(ref, {
        toolCallsUsed,
        requestToolCalls: (session.requestToolCalls ?? 0) + 1,
      });
      return snapshot(sessionId, { ...session, toolCallsUsed });
    });
  }

  completeRequest(input: CompleteRequestInput): Promise<void> {
    return this.firestore.runTransaction(async (transaction) => {
      const sessionRef = this.firestore.doc(`sessions/${input.sessionId}`);
      const sessionDocument = await transaction.get(sessionRef);
      const session = requireSession(sessionDocument.data());

      if (session.activeRequestId !== input.requestId) {
        return;
      }

      const monthRef = this.firestore.doc(`quotaMonths/${session.monthKey}`);

      transaction.update(sessionRef, {
        activeRequestId: null,
        leaseExpiresAtMillis: null,
        requestToolCalls: 0,
        inputTokens: FieldValue.increment(input.inputTokens),
        outputTokens: FieldValue.increment(input.outputTokens),
        cachedInputTokens: FieldValue.increment(input.cachedInputTokens),
        actualMicroUsd: FieldValue.increment(input.actualCostMicroUsd),
        lastLatencyMs: input.latencyMs,
        outcome: input.outcome,
      });
      transaction.set(
        monthRef,
        {
          actualMicroUsd: FieldValue.increment(input.actualCostMicroUsd),
        },
        { merge: true },
      );
    });
  }

  private async cleanupExpiredRecords(nowMillis: number): Promise<void> {
    const cutoff = nowMillis - 32 * 86_400_000;
    const monthCutoff = nowMillis - 400 * 86_400_000;
    const [days, sessions, months] = await Promise.all([
      this.firestore
        .collection('quotaDays')
        .where('updatedAtMillis', '<=', cutoff)
        .limit(20)
        .get(),
      this.firestore
        .collection('sessions')
        .where('expiresAtMillis', '<=', cutoff)
        .limit(20)
        .get(),
      this.firestore
        .collection('quotaMonths')
        .where('updatedAtMillis', '<=', monthCutoff)
        .limit(20)
        .get(),
    ]);
    const documents = [...days.docs, ...sessions.docs, ...months.docs];
    if (documents.length > 0) {
      const batch = this.firestore.batch();
      documents.forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }
}

function hasActiveGuard(
  guards: Record<string, number> | undefined,
  hash: string,
  nowMillis: number,
): boolean {
  return (guards?.[hash] ?? 0) > nowMillis;
}

function requireSession(value: DocumentData | undefined): StoredSession {
  if (!value || typeof value.expiresAtMillis !== 'number') {
    throw new AgentError(
      'SESSION_EXPIRED',
      'The guided session is unavailable.',
    );
  }
  return value as StoredSession;
}

function snapshot(
  sessionId: string,
  session: Pick<
    StoredSession,
    'expiresAtMillis' | 'turnsUsed' | 'toolCallsUsed'
  >,
): SessionSnapshot {
  return {
    sessionId,
    expiresAtMillis: session.expiresAtMillis,
    turnsUsed: session.turnsUsed ?? 0,
    toolCallsUsed: session.toolCallsUsed ?? 0,
  };
}
