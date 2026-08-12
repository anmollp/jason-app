import OpenAI from 'openai';
import type { OpenAiModerationClient } from '../instruction-moderator';

export function createOpenAiModerationClient(
  apiKey: string,
  model: 'omni-moderation-latest',
): OpenAiModerationClient {
  const client = new OpenAI({ apiKey });
  return {
    async moderate(instruction, signal) {
      const response = await client.moderations.create(
        { model, input: instruction },
        { signal },
      );
      const result = response.results[0];
      if (!result || typeof result.flagged !== 'boolean') {
        throw new Error('Malformed moderation response.');
      }
      return result.flagged;
    },
  };
}
