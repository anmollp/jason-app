export type AgentErrorCode =
  | 'FEATURE_DISABLED'
  | 'INVALID_CONFIGURATION'
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
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
