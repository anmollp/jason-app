import { AgentError } from './agent.errors';
import { AGENT_RUNTIME_LIMITS } from './contracts/tool-contracts';

export type AgentConfig =
  | { enabled: false }
  | {
      enabled: true;
      provider: 'openai';
      model: 'gpt-5.6-luna';
      apiKey: string;
      identityKey: Buffer;
      firestoreProjectId?: string;
      cookieSecure: boolean;
      moderationModel: 'omni-moderation-latest';
      dailySessionLimit: 10 | 20;
      monthlySessionLimit: 200;
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
  const identityKey = decodeIdentityKey(env.AI_IDENTITY_KEY);
  const dailySessionLimit = readDailySessionLimit(env.AI_DAILY_SESSION_LIMIT);

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

  if (!identityKey) {
    throw new AgentError(
      'INVALID_CONFIGURATION',
      'AI_IDENTITY_KEY must be a base64-encoded 32-byte secret when AI_ENABLED=true.',
    );
  }

  return {
    enabled: true,
    provider,
    model,
    apiKey,
    identityKey,
    firestoreProjectId: env.GOOGLE_CLOUD_PROJECT,
    cookieSecure: env.AI_COOKIE_SECURE !== 'false',
    moderationModel: 'omni-moderation-latest',
    dailySessionLimit,
    monthlySessionLimit: 200,
    maxOutputTokens: AGENT_RUNTIME_LIMITS.maxOutputTokens,
  };
}

function readDailySessionLimit(value: string | undefined): 10 | 20 {
  if (value === undefined || value === '20') {
    return 20;
  }
  if (value === '10') {
    return 10;
  }
  throw new AgentError(
    'INVALID_CONFIGURATION',
    'AI_DAILY_SESSION_LIMIT must be 10 or 20.',
  );
}

function decodeIdentityKey(value: string | undefined): Buffer | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length === 32 && decoded.toString('base64') === value
      ? decoded
      : undefined;
  } catch {
    return undefined;
  }
}
