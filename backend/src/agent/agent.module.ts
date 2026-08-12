import { Module } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { JsonToolsModule } from '../json-tools.module';
import { AgentAuditLogger } from './agent-audit.logger';
import { AgentClock } from './agent-clock';
import { AgentController } from './agent.controller';
import { readAgentConfig, type AgentConfig } from './agent.config';
import { AgentIdentityService } from './agent-identity.service';
import { AgentProviderRegistry } from './agent-provider.registry';
import { AgentSessionService } from './agent-session.service';
import { AgentStateRepository } from './agent-state.repository';
import { AgentToolExecutor } from './agent-tool-executor.service';
import { AgentToolValidator } from './agent-tool-validator.service';
import { AgentTurnOrchestrator } from './agent-turn-orchestrator.service';
import {
  createOpenAiResponsesClient,
  type OpenAiClientFactory,
} from './providers/openai-responses.provider';
import { FirestoreAgentStateRepository } from './firestore-agent-state.repository';
import {
  InstructionModerator,
  OpenAiInstructionModerator,
  type InstructionModerationClientFactory,
} from './instruction-moderator';
import {
  AGENT_CONFIG,
  MODERATION_CLIENT_FACTORY,
  OPENAI_CLIENT_FACTORY,
} from './agent.tokens';
import { createOpenAiModerationClient } from './providers/openai-moderation.client';

class DisabledAgentStateRepository extends AgentStateRepository {
  issueSession(): Promise<never> {
    return Promise.reject(new Error('The AI copilot is disabled.'));
  }
  reserveTurn(): Promise<never> {
    return Promise.reject(new Error('The AI copilot is disabled.'));
  }
  reserveToolCall(): Promise<never> {
    return Promise.reject(new Error('The AI copilot is disabled.'));
  }
  completeRequest(): Promise<void> {
    return Promise.resolve();
  }
}

class DisabledInstructionModerator extends InstructionModerator {
  assertAllowed(): Promise<never> {
    return Promise.reject(new Error('The AI copilot is disabled.'));
  }
}

@Module({
  imports: [JsonToolsModule],
  controllers: [AgentController],
  providers: [
    AgentAuditLogger,
    AgentClock,
    AgentToolValidator,
    AgentToolExecutor,
    AgentTurnOrchestrator,
    AgentSessionService,
    {
      provide: AGENT_CONFIG,
      useFactory: readAgentConfig,
    },
    {
      provide: OPENAI_CLIENT_FACTORY,
      useValue: createOpenAiResponsesClient,
    },
    {
      provide: MODERATION_CLIENT_FACTORY,
      useValue: createOpenAiModerationClient,
    },
    {
      provide: AgentIdentityService,
      inject: [AGENT_CONFIG],
      useFactory: (config: AgentConfig) =>
        new AgentIdentityService(
          config.enabled ? config.identityKey : Buffer.alloc(32),
          config.enabled ? config.cookieSecure : true,
        ),
    },
    {
      provide: AgentStateRepository,
      inject: [AGENT_CONFIG],
      useFactory: (config: AgentConfig) => {
        if (!config.enabled) {
          return new DisabledAgentStateRepository();
        }
        const firestore = new Firestore({
          ...(config.firestoreProjectId
            ? { projectId: config.firestoreProjectId }
            : {}),
          ignoreUndefinedProperties: true,
        });
        return new FirestoreAgentStateRepository(firestore, {
          dailySessionLimit: config.dailySessionLimit,
          monthlySessionLimit: config.monthlySessionLimit,
        });
      },
    },
    {
      provide: InstructionModerator,
      inject: [AGENT_CONFIG, MODERATION_CLIENT_FACTORY],
      useFactory: (
        config: AgentConfig,
        factory: InstructionModerationClientFactory,
      ) =>
        config.enabled
          ? new OpenAiInstructionModerator(
              factory(config.apiKey, config.moderationModel),
            )
          : new DisabledInstructionModerator(),
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
