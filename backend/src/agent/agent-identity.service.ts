import { Injectable } from '@nestjs/common';
import {
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { isIP } from 'node:net';
import { AgentError } from './agent.errors';

export const AGENT_VISITOR_COOKIE = 'aj_visitor';

export type AnonymousIdentity = {
  visitorHash: string;
  ipHashToday: string;
  ipHashYesterday: string;
};

@Injectable()
export class AgentIdentityService {
  constructor(
    private readonly masterKey: Buffer,
    private readonly cookieSecure: boolean,
  ) {}

  issueVisitorToken(): string {
    const payload = randomBytes(16).toString('base64url');
    const signature = this.signCookiePayload(payload);
    return `v1.${payload}.${signature}`;
  }

  verifyVisitorToken(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const [version, payload, signature, extra] = value.split('.');
    if (version !== 'v1' || !payload || !signature || extra) {
      return undefined;
    }

    const expected = Buffer.from(this.signCookiePayload(payload));
    const actual = Buffer.from(signature);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return undefined;
    }

    try {
      if (Buffer.from(payload, 'base64url').length !== 16) {
        return undefined;
      }
    } catch {
      return undefined;
    }

    return value;
  }

  deriveIdentity(
    visitorToken: string,
    clientIp: string,
    now: Date,
  ): AnonymousIdentity {
    const canonicalIp = canonicalizeIp(clientIp);
    const today = utcDateKey(now);
    const yesterdayDate = new Date(now.getTime() - 86_400_000);
    const yesterday = utcDateKey(yesterdayDate);

    return {
      visitorHash: this.digest('visitor-hmac-v1', visitorToken),
      ipHashToday: this.digest(`ip-hmac-v1:${today}`, canonicalIp),
      ipHashYesterday: this.digest(`ip-hmac-v1:${yesterday}`, canonicalIp),
    };
  }

  deriveSafetyIdentifier(sessionId: string): string {
    return `aj_${this.digest('safety-identifier-v1', sessionId)}`;
  }

  serializeCookie(visitorToken: string): string {
    return [
      `${AGENT_VISITOR_COOKIE}=${visitorToken}`,
      'Path=/',
      'Max-Age=31536000',
      'HttpOnly',
      'SameSite=Lax',
      ...(this.cookieSecure ? ['Secure'] : []),
    ].join('; ');
  }

  private signCookiePayload(payload: string): string {
    return this.digest('cookie-signing-v1', payload);
  }

  private digest(label: string, value: string): string {
    const key = Buffer.from(
      hkdfSync(
        'sha256',
        this.masterKey,
        Buffer.from('askjason-agent-v1'),
        Buffer.from(label),
        32,
      ),
    );
    return createHmac('sha256', key).update(value, 'utf8').digest('base64url');
  }
}

export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const [candidate, ...valueParts] = part.trim().split('=');
    if (candidate === name) {
      return valueParts.join('=') || undefined;
    }
  }

  return undefined;
}

export function canonicalizeIp(value: string): string {
  const trimmed = value.trim();
  const withoutZone = trimmed.includes('%')
    ? trimmed.split('%', 1)[0]
    : trimmed;
  const version = isIP(withoutZone);
  if (version === 0) {
    throw new AgentError(
      'INVALID_IDENTITY',
      'A trusted client IP is required.',
    );
  }

  if (version === 4) {
    return withoutZone;
  }

  const hostname = new URL(`http://[${withoutZone}]/`).hostname;
  return hostname.slice(1, -1).toLowerCase();
}

export function utcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function utcMonthKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}
