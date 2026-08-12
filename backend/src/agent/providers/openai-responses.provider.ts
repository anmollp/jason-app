import OpenAI from 'openai';
import type {
  ResponseCreateParamsStreaming,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses';
import { AgentError } from '../agent.errors';
import type {
  AgentProvider,
  AgentProviderTurn,
  NormalizedToolResult,
  ProviderEvent,
  ProviderTurnRequest,
} from '../contracts/provider-contracts';
import { isAgentToolName } from '../contracts/tool-contracts';

export type OpenAiProviderConfig = {
  model: 'gpt-5.6-luna';
  maxOutputTokens: 700;
};

export interface OpenAiResponsesClient {
  create(
    request: ResponseCreateParamsStreaming,
    signal: AbortSignal,
  ): Promise<AsyncIterable<ResponseStreamEvent>>;
}

export type OpenAiClientFactory = (apiKey: string) => OpenAiResponsesClient;

export function createOpenAiResponsesClient(
  apiKey: string,
): OpenAiResponsesClient {
  const client = new OpenAI({ apiKey });

  return {
    async create(request, signal) {
      return await client.responses.create(request, { signal });
    },
  };
}

export class OpenAiResponsesProvider implements AgentProvider {
  readonly id = 'openai' as const;
  readonly capabilities = {
    streaming: true,
    strictTools: true,
    lowReasoningProfile: true,
    statelessMode: true,
  } as const;

  constructor(
    private readonly client: OpenAiResponsesClient,
    private readonly config: OpenAiProviderConfig,
  ) {}

  createTurn(
    request: ProviderTurnRequest,
    signal: AbortSignal,
  ): Promise<AgentProviderTurn> {
    return Promise.resolve(
      new OpenAiResponsesTurn(this.client, this.config, request, signal),
    );
  }
}

class OpenAiResponsesTurn implements AgentProviderTurn {
  private readonly abortController = new AbortController();
  private readonly removeAbortListener: () => void;
  private readonly conversationItems: ResponseInputItem[];
  private closed = false;

  constructor(
    private readonly client: OpenAiResponsesClient,
    private readonly config: OpenAiProviderConfig,
    private readonly request: ProviderTurnRequest,
    private readonly parentSignal: AbortSignal,
  ) {
    this.conversationItems = request.visibleMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const abort = () => this.abortController.abort(parentSignal.reason);
    if (parentSignal.aborted) {
      abort();
      this.removeAbortListener = () => undefined;
    } else {
      parentSignal.addEventListener('abort', abort, { once: true });
      this.removeAbortListener = () =>
        parentSignal.removeEventListener('abort', abort);
    }
  }

  async *streamRound(
    toolResults: readonly NormalizedToolResult[],
  ): AsyncIterable<ProviderEvent> {
    if (this.closed) {
      throw new AgentError(
        'PROVIDER_PROTOCOL_ERROR',
        'The provider turn is already closed.',
      );
    }

    for (const result of toolResults) {
      this.conversationItems.push({
        type: 'function_call_output',
        call_id: result.callId,
        output: JSON.stringify(result),
      });
    }

    let completedOutput: ResponseOutputItem[] | undefined;

    try {
      const stream = await this.client.create(
        this.createRequest(),
        this.abortController.signal,
      );

      for await (const event of stream) {
        switch (event.type) {
          case 'response.created':
            yield {
              type: 'turn_started',
              providerRequestId: event.response.id,
            };
            break;
          case 'response.output_text.delta':
            yield { type: 'text_delta', text: event.delta };
            break;
          case 'response.output_item.added':
            if (event.item.type === 'function_call') {
              if (!isAgentToolName(event.item.name)) {
                yield unknownToolError();
                return;
              }
              yield {
                type: 'tool_call_started',
                callId: event.item.call_id,
                tool: event.item.name,
              };
            }
            break;
          case 'response.output_item.done':
            if (event.item.type === 'function_call') {
              if (!isAgentToolName(event.item.name)) {
                yield unknownToolError();
                return;
              }
              yield {
                type: 'tool_call_complete',
                callId: event.item.call_id,
                tool: event.item.name,
                argumentsJson: event.item.arguments,
              };
            }
            break;
          case 'response.completed':
            completedOutput = event.response.output;
            yield* usageEvents(event.response.usage);
            yield {
              type: 'completed',
              finishReason: event.response.output.some(
                (item) => item.type === 'function_call',
              )
                ? 'tool'
                : 'stop',
            };
            break;
          case 'response.incomplete':
            completedOutput = event.response.output;
            yield* usageEvents(event.response.usage);
            if (
              event.response.incomplete_details?.reason === 'max_output_tokens'
            ) {
              yield { type: 'completed', finishReason: 'length' };
            } else {
              yield {
                type: 'provider_error',
                retryable: false,
                code: 'incomplete_response',
                safeMessage:
                  'The model could not safely complete the response.',
              };
            }
            break;
          case 'response.failed':
            yield {
              type: 'provider_error',
              retryable: isRetryableCode(event.response.error?.code),
              code: event.response.error?.code ?? 'response_failed',
              safeMessage: 'The model provider could not complete the request.',
            };
            break;
          case 'error':
            yield {
              type: 'provider_error',
              retryable: isRetryableCode(event.code),
              code: event.code ?? 'stream_error',
              safeMessage: 'The model provider stream failed.',
            };
            break;
        }
      }
    } catch (error) {
      if (this.parentSignal.aborted || this.abortController.signal.aborted) {
        throw this.parentSignal.reason instanceof Error
          ? this.parentSignal.reason
          : new Error('The provider request was aborted.');
      }

      yield normalizeOpenAiError(error);
      return;
    }

    if (completedOutput) {
      // This adapter exposes only function tools, so the returned output is a
      // replayable subset of ResponseInputItem despite the SDK's broader union.
      this.conversationItems.push(
        ...(completedOutput as unknown as ResponseInputItem[]),
      );
    }
  }

  close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      this.removeAbortListener();
      this.abortController.abort();
      this.conversationItems.length = 0;
    }

    return Promise.resolve();
  }

  private createRequest(): ResponseCreateParamsStreaming {
    return {
      model: this.config.model,
      instructions: this.request.systemInstruction,
      input: [...this.conversationItems],
      tools: this.request.tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: { ...tool.inputSchema },
        output_schema: { ...tool.resultSchema },
        strict: true,
      })),
      include: ['reasoning.encrypted_content'],
      max_output_tokens: this.config.maxOutputTokens,
      parallel_tool_calls: false,
      reasoning: { effort: 'low', context: 'current_turn' },
      safety_identifier: this.request.privacy.abuseIdentifier,
      service_tier: 'default',
      store: false,
      stream: true,
    };
  }
}

function* usageEvents(
  usage:
    | {
        input_tokens: number;
        output_tokens: number;
        input_tokens_details: { cached_tokens: number };
      }
    | undefined,
): Iterable<ProviderEvent> {
  if (!usage) {
    return;
  }

  yield {
    type: 'usage',
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.input_tokens_details.cached_tokens,
  };
}

function unknownToolError(): ProviderEvent {
  return {
    type: 'provider_error',
    retryable: false,
    code: 'unknown_tool',
    safeMessage: 'The model requested an unavailable tool.',
  };
}

function normalizeOpenAiError(error: unknown): ProviderEvent {
  const status = readNumberProperty(error, 'status');
  const code = readStringProperty(error, 'code') ?? `http_${status ?? 500}`;

  return {
    type: 'provider_error',
    retryable: status === 429 || (status !== undefined && status >= 500),
    code,
    safeMessage: 'The model provider is temporarily unavailable.',
  };
}

function isRetryableCode(code: string | null | undefined): boolean {
  return code === 'rate_limit_exceeded' || code === 'server_error';
}

function readStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === 'string' ? candidate : undefined;
}

function readNumberProperty(
  value: unknown,
  property: string,
): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === 'number' ? candidate : undefined;
}
