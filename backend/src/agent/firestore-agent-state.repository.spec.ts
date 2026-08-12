import type { Firestore } from '@google-cloud/firestore';
import { AgentIdentityService } from './agent-identity.service';
import {
  DAILY_SESSION_LIMIT,
  LOCAL_MONTHLY_LIMIT_MICRO_USD,
  MONTHLY_SESSION_LIMIT,
  SESSION_RESERVATION_MICRO_USD,
} from './agent-state.repository';
import { FirestoreAgentStateRepository } from './firestore-agent-state.repository';

const identityService = new AgentIdentityService(Buffer.alloc(32, 5), true);

describe('FirestoreAgentStateRepository', () => {
  const now = Date.parse('2026-08-12T12:00:00.000Z');

  it('enforces one rolling session for either visitor or IP identity', async () => {
    const firestore = new FakeFirestore();
    const repository = createRepository(firestore);
    const visitor = identityService.issueVisitorToken();

    await repository.issueSession(
      issueInput('session-1', visitor, '203.0.113.7', now),
    );

    await expect(
      repository.issueSession(
        issueInput('session-2', visitor, '198.51.100.8', now + 1),
      ),
    ).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
    await expect(
      repository.issueSession(
        issueInput(
          'session-3',
          identityService.issueVisitorToken(),
          '203.0.113.7',
          now + 1,
        ),
      ),
    ).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
  });

  it('carries the daily IP guard across the UTC date boundary', async () => {
    const firestore = new FakeFirestore();
    const repository = createRepository(firestore);
    const firstTime = Date.parse('2026-08-12T23:59:59.000Z');
    const secondTime = Date.parse('2026-08-13T00:00:01.000Z');

    await repository.issueSession(
      issueInput(
        'session-1',
        identityService.issueVisitorToken(),
        '203.0.113.7',
        firstTime,
      ),
    );
    await expect(
      repository.issueSession(
        issueInput(
          'session-2',
          identityService.issueVisitorToken(),
          '203.0.113.7',
          secondTime,
        ),
      ),
    ).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
  });

  it.each([
    [
      'daily quota',
      'quotaDays/2026-08-12',
      { sessionCount: DAILY_SESSION_LIMIT },
      'QUOTA_EXHAUSTED',
    ],
    [
      'monthly quota',
      'quotaMonths/2026-08',
      { sessionCount: MONTHLY_SESSION_LIMIT },
      'QUOTA_EXHAUSTED',
    ],
    [
      'reserved spend ceiling',
      'quotaMonths/2026-08',
      {
        reservedMicroUsd:
          LOCAL_MONTHLY_LIMIT_MICRO_USD - SESSION_RESERVATION_MICRO_USD + 1,
      },
      'BUDGET_EXHAUSTED',
    ],
  ])('fails closed at the %s', async (_name, path, ledger, code) => {
    const firestore = new FakeFirestore();
    firestore.setRaw(path, ledger);
    const repository = createRepository(firestore);

    await expect(
      repository.issueSession(
        issueInput(
          'session-limit',
          identityService.issueVisitorToken(),
          '203.0.113.9',
          now,
        ),
      ),
    ).rejects.toMatchObject({ code });
  });

  it('consumes accepted turns and rejects concurrency and fourth turns', async () => {
    const firestore = new FakeFirestore();
    const repository = createRepository(firestore);
    await repository.issueSession(
      issueInput(
        'session-turns',
        identityService.issueVisitorToken(),
        '203.0.113.10',
        now,
      ),
    );

    await repository.reserveTurn(turnInput('session-turns', 'request-1', now));
    await expect(
      repository.reserveTurn(turnInput('session-turns', 'request-2', now + 1)),
    ).rejects.toMatchObject({ code: 'CONCURRENT_REQUEST' });

    expireLease(firestore, 'session-turns');
    await repository.reserveTurn(
      turnInput('session-turns', 'request-2', now + 2),
    );
    expireLease(firestore, 'session-turns');
    await repository.reserveTurn(
      turnInput('session-turns', 'request-3', now + 3),
    );
    expireLease(firestore, 'session-turns');
    await expect(
      repository.reserveTurn(turnInput('session-turns', 'request-4', now + 4)),
    ).rejects.toMatchObject({ code: 'TURN_LIMIT_EXCEEDED' });
  });

  it('enforces two tool calls per turn and four per session', async () => {
    const firestore = new FakeFirestore();
    const repository = createRepository(firestore);
    await repository.issueSession(
      issueInput(
        'session-tools',
        identityService.issueVisitorToken(),
        '203.0.113.11',
        now,
      ),
    );

    await repository.reserveTurn(turnInput('session-tools', 'request-1', now));
    await repository.reserveToolCall('session-tools', 'request-1', now + 1);
    await repository.reserveToolCall('session-tools', 'request-1', now + 2);
    await expect(
      repository.reserveToolCall('session-tools', 'request-1', now + 3),
    ).rejects.toMatchObject({ code: 'TOOL_LIMIT_EXCEEDED' });

    expireLease(firestore, 'session-tools');
    await repository.reserveTurn(
      turnInput('session-tools', 'request-2', now + 4),
    );
    await repository.reserveToolCall('session-tools', 'request-2', now + 5);
    await repository.reserveToolCall('session-tools', 'request-2', now + 6);
    expireLease(firestore, 'session-tools');
    await repository.reserveTurn(
      turnInput('session-tools', 'request-3', now + 7),
    );
    await expect(
      repository.reserveToolCall('session-tools', 'request-3', now + 8),
    ).rejects.toMatchObject({ code: 'SESSION_TOOL_LIMIT_EXCEEDED' });
  });
});

function createRepository(firestore: FakeFirestore) {
  return new FirestoreAgentStateRepository(firestore as unknown as Firestore);
}

function issueInput(
  sessionId: string,
  visitorToken: string,
  ip: string,
  at: number,
) {
  const date = new Date(at);
  const yesterday = new Date(at - 86_400_000);
  return {
    sessionId,
    sessionHash: `hash-${sessionId}`,
    identity: identityService.deriveIdentity(visitorToken, ip, date),
    nowMillis: at,
    expiresAtMillis: at + 86_400_000,
    todayKey: date.toISOString().slice(0, 10),
    yesterdayKey: yesterday.toISOString().slice(0, 10),
    monthKey: date.toISOString().slice(0, 7),
    provider: 'openai',
    model: 'gpt-5.6-luna',
  };
}

function turnInput(sessionId: string, requestId: string, at: number) {
  return {
    sessionId,
    requestId,
    selectedTool: 'formatter',
    nowMillis: at,
    leaseExpiresAtMillis: at + 65_000,
  };
}

function expireLease(firestore: FakeFirestore, sessionId: string) {
  const session = firestore.getRaw(`sessions/${sessionId}`);
  firestore.setRaw(`sessions/${sessionId}`, {
    ...session,
    activeRequestId: null,
    leaseExpiresAtMillis: null,
    requestToolCalls: 0,
  });
}

type Data = Record<string, unknown>;

class FakeFirestore {
  private readonly records = new Map<string, Data>();

  setRaw(path: string, value: Data): void {
    this.records.set(path, structuredClone(value));
  }

  getRaw(path: string): Data {
    return structuredClone(this.records.get(path) ?? {});
  }

  doc(path: string) {
    return {
      path,
      delete: async () => {
        await Promise.resolve();
        this.records.delete(path);
      },
    };
  }

  runTransaction<T>(
    callback: (transaction: FakeTransaction) => Promise<T>,
  ): Promise<T> {
    return callback(new FakeTransaction(this.records));
  }

  collection() {
    return {
      where: () => ({
        limit: () => ({
          get: async () => {
            await Promise.resolve();
            return { empty: true, docs: [] };
          },
        }),
      }),
    };
  }

  batch() {
    return {
      delete: () => undefined,
      commit: async () => Promise.resolve(),
    };
  }
}

class FakeTransaction {
  constructor(private readonly records: Map<string, Data>) {}

  async get(ref: { path: string }) {
    await Promise.resolve();
    const value = this.records.get(ref.path);
    return {
      exists: value !== undefined,
      data: () => (value === undefined ? undefined : structuredClone(value)),
    };
  }

  set(ref: { path: string }, value: Data, options?: { merge?: boolean }): void {
    const previous = options?.merge ? (this.records.get(ref.path) ?? {}) : {};
    this.records.set(ref.path, { ...previous, ...structuredClone(value) });
  }

  create(ref: { path: string }, value: Data): void {
    if (this.records.has(ref.path)) {
      throw new Error('already_exists');
    }
    this.records.set(ref.path, structuredClone(value));
  }

  update(ref: { path: string }, value: Data): void {
    const previous = this.records.get(ref.path);
    if (!previous) {
      throw new Error('not_found');
    }
    this.records.set(ref.path, { ...previous, ...structuredClone(value) });
  }
}
