import type {
  AGENT_PROMPT_VERSION,
  AgentToolName,
  ProviderNeutralToolDefinition,
} from './tool-contracts';

export type GenerationProviderId = 'openai' | 'google' | 'anthropic';

export type NormalizedMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ProviderTurnRequest = {
  contractVersion: 'askjason.agent.v1';
  promptVersion: typeof AGENT_PROMPT_VERSION;
  systemInstruction: string;
  visibleMessages: readonly NormalizedMessage[];
  tools: readonly ProviderNeutralToolDefinition[];
  limits: {
    maxRoundTrips: 2;
    maxToolCalls: 2;
    maxOutputTokens: 700;
    reasoningProfile: 'low';
    latencyTier: 'standard';
  };
  privacy: {
    retainProviderState: false;
    abuseIdentifier: string;
  };
};

export type ProviderToolCall = {
  callId: string;
  tool: AgentToolName;
  argumentsJson: string;
};

export type NormalizedToolErrorCode =
  | 'INVALID_ARGUMENTS'
  | 'INVALID_JSON'
  | 'RUST_REJECTED'
  | 'TIMEOUT';

export type NormalizedToolResult =
  | {
      ok: true;
      tool: AgentToolName;
      callId: string;
      data: unknown;
      validation: { engine: 'jason'; valid: true };
    }
  | {
      ok: false;
      tool: AgentToolName;
      callId: string;
      error: {
        code: NormalizedToolErrorCode;
        field?: 'input' | 'before' | 'after' | 'document' | 'patch' | 'path';
        message: string;
      };
    };

export type ProviderEvent =
  | { type: 'turn_started'; providerRequestId?: string }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_started'; callId: string; tool: AgentToolName }
  | ({ type: 'tool_call_complete' } & ProviderToolCall)
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens?: number;
    }
  | { type: 'completed'; finishReason: 'stop' | 'tool' | 'length' }
  | {
      type: 'provider_error';
      retryable: boolean;
      code: string;
      safeMessage: string;
    };

export type AgentTurnEvent =
  | ProviderEvent
  | { type: 'tool_result'; result: NormalizedToolResult };

export type AgentTurnHooks = {
  beforeToolCall?: (call: ProviderToolCall) => Promise<void>;
};

export interface AgentProvider {
  readonly id: GenerationProviderId;
  readonly capabilities: {
    streaming: true;
    strictTools: boolean;
    lowReasoningProfile: boolean;
    statelessMode: boolean;
  };

  createTurn(
    request: ProviderTurnRequest,
    signal: AbortSignal,
  ): Promise<AgentProviderTurn>;
}

export interface AgentProviderTurn {
  streamRound(
    toolResults: readonly NormalizedToolResult[],
  ): AsyncIterable<ProviderEvent>;
  close(): Promise<void>;
}
