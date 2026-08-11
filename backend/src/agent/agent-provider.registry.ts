import { AgentError } from './agent.errors';
import type { AgentConfig } from './agent.config';
import type { AgentProvider } from './contracts/provider-contracts';
import {
  OpenAiResponsesProvider,
  type OpenAiClientFactory,
} from './providers/openai-responses.provider';

export class AgentProviderRegistry {
  private provider: AgentProvider | undefined;

  constructor(
    private readonly config: AgentConfig,
    private readonly openAiClientFactory: OpenAiClientFactory,
  ) {}

  getProvider(): AgentProvider {
    if (!this.config.enabled) {
      throw new AgentError('FEATURE_DISABLED', 'The AI copilot is disabled.');
    }

    this.provider ??= new OpenAiResponsesProvider(
      this.openAiClientFactory(this.config.apiKey),
      {
        model: this.config.model,
        maxOutputTokens: this.config.maxOutputTokens,
      },
    );

    return this.provider;
  }
}
