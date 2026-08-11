import { AgentError } from './agent.errors';
import { AGENT_RUNTIME_LIMITS } from './contracts/tool-contracts';

export type AgentConfig =
  | { enabled: false }
  | {
      enabled: true;
      provider: 'openai';
      model: 'gpt-5.6-luna';
      apiKey: string;
      maxOutputTokens: 700;
    };

export function readAgentConfig(
  env: NodeJS.ProcessEnv = process.env,
): AgentConfig {
  if (env.AI_ENABLED !== 'true') {
    return { enabled: false };
  }

  const provider = env.AI_PROVIDER ?? 'openai';
  const model = env.AI_MODEL ?? 'gpt-5.6-luna';
  const apiKey = env.OPENAI_API_KEY;

  if (provider !== 'openai') {
    throw new AgentError(
      'INVALID_CONFIGURATION',
      `AI_PROVIDER=${provider} is not implemented in this release.`,
    );
  }

  if (model !== 'gpt-5.6-luna') {
    throw new AgentError(
      'INVALID_CONFIGURATION',
      `AI_MODEL=${model} is not in the approved model allowlist.`,
    );
  }

  if (!apiKey) {
    throw new AgentError(
      'INVALID_CONFIGURATION',
      'OPENAI_API_KEY is required when AI_ENABLED=true.',
    );
  }

  return {
    enabled: true,
    provider,
    model,
    apiKey,
    maxOutputTokens: AGENT_RUNTIME_LIMITS.maxOutputTokens,
  };
}
