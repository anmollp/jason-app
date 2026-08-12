import type {
  AgentProvider,
  AgentProviderTurn,
  NormalizedToolResult,
  ProviderEvent,
  ProviderTurnRequest,
} from '../contracts/provider-contracts';

export type FakeProviderRound = readonly ProviderEvent[];

export class FakeAgentProvider implements AgentProvider {
  readonly id = 'openai' as const;
  readonly capabilities = {
    streaming: true,
    strictTools: true,
    lowReasoningProfile: true,
    statelessMode: true,
  } as const;
  readonly requests: ProviderTurnRequest[] = [];
  readonly turns: FakeAgentProviderTurn[] = [];

  constructor(private readonly rounds: readonly FakeProviderRound[]) {}

  createTurn(
    request: ProviderTurnRequest,
    signal: AbortSignal,
  ): Promise<AgentProviderTurn> {
    if (signal.aborted) {
      return Promise.reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error('The fake provider turn was aborted.'),
      );
    }

    this.requests.push(request);
    const turn = new FakeAgentProviderTurn(this.rounds);
    this.turns.push(turn);
    return Promise.resolve(turn);
  }
}

export class FakeAgentProviderTurn implements AgentProviderTurn {
  readonly receivedToolResults: (readonly NormalizedToolResult[])[] = [];
  closeCount = 0;
  private roundIndex = 0;

  constructor(private readonly rounds: readonly FakeProviderRound[]) {}

  async *streamRound(
    toolResults: readonly NormalizedToolResult[],
  ): AsyncIterable<ProviderEvent> {
    await Promise.resolve();
    this.receivedToolResults.push(toolResults);
    const round = this.rounds[this.roundIndex] ?? [];
    this.roundIndex += 1;

    for (const event of round) {
      yield event;
    }
  }

  close(): Promise<void> {
    this.closeCount += 1;
    return Promise.resolve();
  }
}
