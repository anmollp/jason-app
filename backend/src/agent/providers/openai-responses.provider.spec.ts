import type {
  Response,
  ResponseOutputItem,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses';
import type {
  NormalizedToolResult,
  ProviderEvent,
  ProviderTurnRequest,
} from '../contracts/provider-contracts';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_VERSION,
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
} from '../contracts/tool-contracts';
import {
  OpenAiResponsesProvider,
  type OpenAiResponsesClient,
} from './openai-responses.provider';

describe('OpenAiResponsesProvider', () => {
  it('maps strict Responses API streaming across a turn-local two-round session', async () => {
    const functionCall = {
      type: 'function_call',
      id: 'fc-1',
      call_id: 'call-1',
      name: 'format_json',
      arguments: '{"input":"{\\"a\\":1}"}',
      status: 'completed',
    } as const;
    const firstOutput = [
      {
        type: 'reasoning',
        id: 'rs-1',
        summary: [],
        encrypted_content: 'opaque',
      },
      functionCall,
    ] as unknown as ResponseOutputItem[];
    const client = createMockClient([
      [
        event({
          type: 'response.created',
          response: response('resp-1', []),
          sequence_number: 0,
        }),
        event({
          type: 'response.output_item.added',
          item: functionCall,
          output_index: 1,
          sequence_number: 1,
        }),
        event({
          type: 'response.output_item.done',
          item: functionCall,
          output_index: 1,
          sequence_number: 2,
        }),
        event({
          type: 'response.completed',
          response: response('resp-1', firstOutput),
          sequence_number: 3,
        }),
      ],
      [
        event({
          type: 'response.output_text.delta',
          delta: 'Validated.',
          sequence_number: 0,
          item_id: 'msg-1',
          output_index: 0,
          content_index: 0,
          logprobs: [],
        }),
        event({
          type: 'response.completed',
          response: response('resp-2', []),
          sequence_number: 1,
        }),
      ],
    ]);
    const provider = new OpenAiResponsesProvider(client, {
      model: 'gpt-5.6-luna',
      maxOutputTokens: 700,
    });
    const turn = await provider.createTurn(
      createRequest(),
      new AbortController().signal,
    );

    const roundOne = await collect(turn.streamRound([]));
    const toolResult: NormalizedToolResult = {
      ok: true,
      tool: 'format_json',
      callId: 'call-1',
      data: { output: '{\n  "a": 1\n}' },
      validation: { engine: 'jason', valid: true },
    };
    const roundTwo = await collect(turn.streamRound([toolResult]));
    await turn.close();

    expect(roundOne).toContainEqual({
      type: 'tool_call_complete',
      callId: 'call-1',
      tool: 'format_json',
      argumentsJson: functionCall.arguments,
    });
    expect(roundTwo).toContainEqual({ type: 'text_delta', text: 'Validated.' });
    expect(client.create.mock.calls).toHaveLength(2);

    const firstRequest = client.create.mock.calls[0][0];
    expect(firstRequest).toMatchObject({
      model: 'gpt-5.6-luna',
      max_output_tokens: 700,
      parallel_tool_calls: false,
      reasoning: { effort: 'low', context: 'current_turn' },
      safety_identifier: 'anon-hash',
      service_tier: 'default',
      store: false,
      stream: true,
    });
    expect(firstRequest.instructions).toBe('Static system instruction.');
    expect(firstRequest.tools).toHaveLength(4);
    expect(firstRequest.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function',
          name: 'format_json',
          strict: true,
        }),
      ]),
    );

    const secondInput = client.create.mock.calls[1][0].input;
    expect(secondInput).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'reasoning',
          encrypted_content: 'opaque',
        }),
        expect.objectContaining({ type: 'function_call', call_id: 'call-1' }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call-1',
        }),
      ]),
    );
  });

  it('normalizes upstream 429 errors without making a network call', async () => {
    const client = {
      create: jest.fn().mockRejectedValue({
        status: 429,
        code: 'rate_limit_exceeded',
        message: 'raw provider detail',
      }),
    } as unknown as jest.Mocked<OpenAiResponsesClient>;
    const provider = new OpenAiResponsesProvider(client, {
      model: 'gpt-5.6-luna',
      maxOutputTokens: 700,
    });
    const turn = await provider.createTurn(
      createRequest(),
      new AbortController().signal,
    );

    await expect(collect(turn.streamRound([]))).resolves.toEqual([
      {
        type: 'provider_error',
        retryable: true,
        code: 'rate_limit_exceeded',
        safeMessage: 'The model provider is temporarily unavailable.',
      },
    ]);
    await turn.close();
  });
});

function createMockClient(
  rounds: readonly (readonly ResponseStreamEvent[])[],
): jest.Mocked<OpenAiResponsesClient> {
  let index = 0;
  return {
    create: jest.fn(() => Promise.resolve(stream(rounds[index++] ?? []))),
  };
}

async function* stream(
  events: readonly ResponseStreamEvent[],
): AsyncIterable<ResponseStreamEvent> {
  await Promise.resolve();
  for (const item of events) {
    yield item;
  }
}

function event(value: unknown): ResponseStreamEvent {
  return value as ResponseStreamEvent;
}

function response(id: string, output: ResponseOutputItem[]): Response {
  return {
    id,
    output,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      input_tokens_details: { cached_tokens: 2, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 1 },
    },
  } as Response;
}

function createRequest(): ProviderTurnRequest {
  return {
    contractVersion: AGENT_CONTRACT_VERSION,
    promptVersion: AGENT_PROMPT_VERSION,
    systemInstruction: 'Static system instruction.',
    visibleMessages: [
      { role: 'user', content: 'Untrusted instruction and selected JSON.' },
    ],
    tools: AGENT_TOOL_DEFINITIONS,
    limits: {
      maxRoundTrips: AGENT_RUNTIME_LIMITS.modelRoundTripsPerTurn,
      maxToolCalls: AGENT_RUNTIME_LIMITS.toolCallsPerTurn,
      maxOutputTokens: AGENT_RUNTIME_LIMITS.maxOutputTokens,
      reasoningProfile: 'low',
      latencyTier: 'standard',
    },
    privacy: { retainProviderState: false, abuseIdentifier: 'anon-hash' },
  };
}

async function collect(
  events: AsyncIterable<ProviderEvent>,
): Promise<ProviderEvent[]> {
  const result: ProviderEvent[] = [];
  for await (const item of events) {
    result.push(item);
  }
  return result;
}
