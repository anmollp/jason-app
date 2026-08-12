import { AgentAuditLogger } from './agent-audit.logger';

describe('AgentAuditLogger', () => {
  it('writes one structured, metadata-only JSON record', () => {
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      new AgentAuditLogger().write({
        event: 'message',
        sessionHash: 'aj_hash',
        tool: 'formatter',
        provider: 'openai',
        model: 'gpt-5.6-luna',
        latencyMs: 250,
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 5,
        estimatedCostMicroUsd: 43,
        outcome: 'completed',
      });

      const record = JSON.parse(String(write.mock.calls[0][0])) as Record<
        string,
        unknown
      >;
      expect(record).toEqual({
        severity: 'INFO',
        component: 'AgentAudit',
        event: 'message',
        sessionHash: 'aj_hash',
        tool: 'formatter',
        provider: 'openai',
        model: 'gpt-5.6-luna',
        latencyMs: 250,
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 5,
        estimatedCostMicroUsd: 43,
        outcome: 'completed',
      });
      expect(record).not.toHaveProperty('prompt');
      expect(record).not.toHaveProperty('instruction');
      expect(record).not.toHaveProperty('document');
      expect(record).not.toHaveProperty('response');
      expect(record).not.toHaveProperty('ipAddress');
      expect(record).not.toHaveProperty('userAgent');
    } finally {
      write.mockRestore();
    }
  });
});
