import { Injectable } from '@nestjs/common';
import { AgentError } from './agent.errors';

export abstract class InstructionModerator {
  abstract assertAllowed(
    instruction: string,
    signal: AbortSignal,
  ): Promise<void>;
}

export interface OpenAiModerationClient {
  moderate(instruction: string, signal: AbortSignal): Promise<boolean>;
}

export type InstructionModerationClientFactory = (
  apiKey: string,
  model: 'omni-moderation-latest',
) => OpenAiModerationClient;

@Injectable()
export class OpenAiInstructionModerator extends InstructionModerator {
  constructor(private readonly client: OpenAiModerationClient) {
    super();
  }

  async assertAllowed(instruction: string, signal: AbortSignal): Promise<void> {
    try {
      const flagged = await this.client.moderate(instruction, signal);
      if (typeof flagged !== 'boolean') {
        throw new Error('Malformed moderation decision.');
      }
      if (flagged) {
        throw new AgentError(
          'MODERATION_BLOCKED',
          'The instruction could not be processed safely.',
        );
      }
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      if (signal.aborted) {
        throw signal.reason instanceof Error
          ? signal.reason
          : new AgentError('REQUEST_TIMEOUT', 'The request timed out.');
      }
      throw new AgentError(
        'MODERATION_UNAVAILABLE',
        'Instruction safety validation is temporarily unavailable.',
        true,
      );
    }
  }
}
