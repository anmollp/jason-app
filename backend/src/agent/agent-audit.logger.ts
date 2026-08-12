import { Injectable } from '@nestjs/common';

export type AgentAuditEvent = {
  event: 'session' | 'message';
  sessionHash: string;
  tool?: string;
  provider?: string;
  model?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedCostMicroUsd: number;
  outcome: string;
};

@Injectable()
export class AgentAuditLogger {
  write(event: AgentAuditEvent): void {
    process.stdout.write(
      `${JSON.stringify({ severity: 'INFO', component: 'AgentAudit', ...event })}\n`,
    );
  }
}
