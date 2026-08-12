import { Module } from '@nestjs/common';
import { JsonToolsModule } from '../json-tools.module';
import { readAgentConfig, type AgentConfig } from './agent.config';
import { AgentProviderRegistry } from './agent-provider.registry';
import { AgentToolExecutor } from './agent-tool-executor.service';
import { AgentToolValidator } from './agent-tool-validator.service';
import { AgentTurnOrchestrator } from './agent-turn-orchestrator.service';
import {
  createOpenAiResponsesClient,
  type OpenAiClientFactory,
} from './providers/openai-responses.provider';

export const AGENT_CONFIG = Symbol('AGENT_CONFIG');
export const OPENAI_CLIENT_FACTORY = Symbol('OPENAI_CLIENT_FACTORY');

@Module({
  imports: [JsonToolsModule],
  providers: [
    AgentToolValidator,
    AgentToolExecutor,
    AgentTurnOrchestrator,
    {
      provide: AGENT_CONFIG,
      useFactory: readAgentConfig,
    },
    {
      provide: OPENAI_CLIENT_FACTORY,
      useValue: createOpenAiResponsesClient,
    },
    {
      provide: AgentProviderRegistry,
      inject: [AGENT_CONFIG, OPENAI_CLIENT_FACTORY],
      useFactory: (config: AgentConfig, clientFactory: OpenAiClientFactory) =>
        new AgentProviderRegistry(config, clientFactory),
    },
  ],
  exports: [AgentProviderRegistry, AgentTurnOrchestrator],
})
export class AgentModule {}
