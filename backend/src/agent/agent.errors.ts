export type AgentErrorCode =
  | 'FEATURE_DISABLED'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_REQUEST'
  | 'INVALID_IDENTITY'
  | 'SESSION_EXPIRED'
  | 'QUOTA_EXHAUSTED'
  | 'BUDGET_EXHAUSTED'
  | 'TURN_LIMIT_EXCEEDED'
  | 'SESSION_TOOL_LIMIT_EXCEEDED'
  | 'CONCURRENT_REQUEST'
  | 'MODERATION_BLOCKED'
  | 'MODERATION_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'UNKNOWN_TOOL'
  | 'INVALID_TOOL_ARGUMENTS'
  | 'INVALID_TOOL_RESULT'
  | 'DUPLICATE_TOOL_CALL'
  | 'TOOL_LIMIT_EXCEEDED'
  | 'ROUND_LIMIT_EXCEEDED'
  | 'PROVIDER_PROTOCOL_ERROR';

export class AgentError extends Error {
  constructor(
    readonly code: AgentErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export type PublicAgentErrorEvent = {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
};

export function normalizePublicError(error: unknown): PublicAgentErrorEvent {
  if (error instanceof AgentError) {
    return {
      type: 'error',
      code: error.code.toLowerCase(),
      message: error.message,
      retryable: error.retryable,
    };
  }
  return {
    type: 'error',
    code: 'agent_unavailable',
    message: 'The AI copilot is temporarily unavailable.',
    retryable: true,
  };
}
