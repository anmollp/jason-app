import { AgentProviderRegistry } from './agent-provider.registry';
import { readAgentConfig } from './agent.config';
import type { OpenAiClientFactory } from './providers/openai-responses.provider';

describe('agent configuration and provider registry', () => {
  const identityKey = Buffer.alloc(32, 7).toString('base64');

  it('defaults to disabled and creates no OpenAI client', () => {
    const factory = jest.fn() as jest.MockedFunction<OpenAiClientFactory>;
    const registry = new AgentProviderRegistry(readAgentConfig({}), factory);

    let thrown: unknown;
    try {
      registry.getProvider();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(factory).not.toHaveBeenCalled();
  });

  it('lazily creates one approved OpenAI provider when enabled', () => {
    const client = { create: jest.fn() };
    const factory = jest.fn(() => client) as OpenAiClientFactory;
    const registry = new AgentProviderRegistry(
      readAgentConfig({
        AI_ENABLED: 'true',
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-5.6-luna',
        OPENAI_API_KEY: 'test-key',
        AI_IDENTITY_KEY: identityKey,
      }),
      factory,
    );

    expect(registry.getProvider()).toBe(registry.getProvider());
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('test-key');
    expect(
      readAgentConfig({
        AI_ENABLED: 'true',
        OPENAI_API_KEY: 'test-key',
        AI_IDENTITY_KEY: identityKey,
        AI_DAILY_SESSION_LIMIT: '10',
      }),
    ).toMatchObject({ dailySessionLimit: 10, monthlySessionLimit: 200 });
  });

  it('fails closed for unapproved providers, models, or a missing secret', () => {
    expect(() =>
      readAgentConfig({
        AI_ENABLED: 'true',
        AI_PROVIDER: 'google',
        OPENAI_API_KEY: 'test-key',
        AI_IDENTITY_KEY: identityKey,
      }),
    ).toThrow('not implemented');
    expect(() =>
      readAgentConfig({
        AI_ENABLED: 'true',
        AI_MODEL: 'gpt-5.6-terra',
        OPENAI_API_KEY: 'test-key',
        AI_IDENTITY_KEY: identityKey,
      }),
    ).toThrow('approved model allowlist');
    expect(() => readAgentConfig({ AI_ENABLED: 'true' })).toThrow(
      'OPENAI_API_KEY is required',
    );
    expect(() =>
      readAgentConfig({
        AI_ENABLED: 'true',
        OPENAI_API_KEY: 'test-key',
        AI_IDENTITY_KEY: 'not-a-valid-key',
      }),
    ).toThrow('AI_IDENTITY_KEY');
    expect(() =>
      readAgentConfig({
        AI_ENABLED: 'true',
        OPENAI_API_KEY: 'test-key',
        AI_IDENTITY_KEY: identityKey,
        AI_DAILY_SESSION_LIMIT: '21',
      }),
    ).toThrow('AI_DAILY_SESSION_LIMIT');
  });
});
