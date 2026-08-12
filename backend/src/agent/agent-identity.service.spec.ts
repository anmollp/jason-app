import {
  AGENT_VISITOR_COOKIE,
  AgentIdentityService,
  canonicalizeIp,
  readCookie,
} from './agent-identity.service';

describe('AgentIdentityService', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const service = new AgentIdentityService(Buffer.alloc(32, 9), true);

  it('signs and verifies a non-reversible visitor token', () => {
    const token = service.issueVisitorToken();
    const cookie = service.serializeCookie(token);

    expect(service.verifyVisitorToken(token)).toBe(token);
    expect(service.verifyVisitorToken(`${token}tampered`)).toBeUndefined();
    expect(cookie).toContain(`${AGENT_VISITOR_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(readCookie(cookie, AGENT_VISITOR_COOKIE)).toBe(token);
  });

  it('derives stable visitor and daily rotating IP hashes without exposing inputs', () => {
    const token = service.issueVisitorToken();
    const first = service.deriveIdentity(token, '203.0.113.9', now);
    const sameDay = service.deriveIdentity(
      token,
      '203.0.113.9',
      new Date('2026-08-12T23:59:59.000Z'),
    );
    const nextDay = service.deriveIdentity(
      token,
      '203.0.113.9',
      new Date('2026-08-13T00:00:01.000Z'),
    );

    expect(first.visitorHash).toBe(sameDay.visitorHash);
    expect(first.ipHashToday).toBe(sameDay.ipHashToday);
    expect(first.ipHashToday).not.toBe(nextDay.ipHashToday);
    expect(JSON.stringify(first)).not.toContain('203.0.113.9');
  });

  it('canonicalizes supported addresses and rejects invalid identity input', () => {
    expect(canonicalizeIp(' 203.0.113.9 ')).toBe('203.0.113.9');
    expect(canonicalizeIp('2001:0db8:0:0:0:0:0:1')).toBe('2001:db8::1');
    expect(() => canonicalizeIp('not-an-ip')).toThrow('trusted client IP');
  });
});
