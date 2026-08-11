import { AgentProviderRegistry } from './agent-provider.registry';
import { readAgentConfig } from './agent.config';
import type { OpenAiClientFactory } from './providers/openai-responses.provider';

describe('agent configuration and provider registry', () => {
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
      }),
      factory,
    );

    expect(registry.getProvider()).toBe(registry.getProvider());
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('test-key');
  });

  it('fails closed for unapproved providers, models, or a missing secret', () => {
    expect(() =>
      readAgentConfig({
        AI_ENABLED: 'true',
        AI_PROVIDER: 'google',
        OPENAI_API_KEY: 'test-key',
      }),
    ).toThrow('not implemented');
    expect(() =>
      readAgentConfig({
        AI_ENABLED: 'true',
        AI_MODEL: 'gpt-5.6-terra',
        OPENAI_API_KEY: 'test-key',
      }),
    ).toThrow('approved model allowlist');
    expect(() => readAgentConfig({ AI_ENABLED: 'true' })).toThrow(
      'OPENAI_API_KEY is required',
    );
  });
});
