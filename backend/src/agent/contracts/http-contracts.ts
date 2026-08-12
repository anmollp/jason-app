import { AgentError } from '../agent.errors';
import { AGENT_RUNTIME_LIMITS, type AgentToolName } from './tool-contracts';

export type AgentSelectedTool = 'formatter' | 'diff' | 'patch' | 'pointer';

export type AgentVisibleMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentMessageRequest = {
  sessionId: string;
  selectedTool: AgentSelectedTool;
  instruction: string;
  context: Record<string, string>;
  visibleMessages: readonly AgentVisibleMessage[];
};

export type AgentSessionResponse = {
  sessionId: string;
  expiresAt: string;
  remainingTurns: number;
  remainingToolCalls: number;
};

export type AgentPublicEvent =
  | { type: 'status'; phase: string; message: string }
  | { type: 'tool_call'; tool: AgentToolName }
  | {
      type: 'tool_result';
      tool: AgentToolName;
      ok: boolean;
      validation?: string;
    }
  | { type: 'message'; delta: string }
  | {
      type: 'proposal';
      tool: AgentSelectedTool;
      data: unknown;
      validation: 'jason';
    }
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      estimatedCostMicroUsd: number;
      remainingTurns: number;
      remainingToolCalls: number;
    }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done' };

const contextFields: Record<AgentSelectedTool, readonly string[]> = {
  formatter: ['input'],
  diff: ['before', 'after'],
  patch: ['document', 'patch'],
  pointer: ['document', 'path'],
};

export function parseAgentMessageRequest(value: unknown): AgentMessageRequest {
  if (!isRecord(value)) {
    invalid('Request body must be a JSON object.');
  }

  const allowedTopLevel = new Set([
    'sessionId',
    'selectedTool',
    'instruction',
    'context',
    'visibleMessages',
  ]);
  assertNoExtraKeys(value, allowedTopLevel);

  const sessionId = readBoundedString(value.sessionId, 'sessionId', 256, 1);
  const selectedTool = value.selectedTool;
  if (
    selectedTool !== 'formatter' &&
    selectedTool !== 'diff' &&
    selectedTool !== 'patch' &&
    selectedTool !== 'pointer'
  ) {
    invalid('selectedTool must be formatter, diff, patch, or pointer.');
  }

  const instruction = readBoundedString(
    value.instruction,
    'instruction',
    AGENT_RUNTIME_LIMITS.instructionCharacters,
    1,
  );
  if (!isRecord(value.context)) {
    invalid('context must be an object of strings.');
  }

  const allowedContext = new Set(contextFields[selectedTool]);
  assertNoExtraKeys(value.context, allowedContext);
  const context: Record<string, string> = {};
  for (const field of allowedContext) {
    const candidate = value.context[field];
    if (candidate !== undefined) {
      context[field] = readBoundedString(
        candidate,
        `context.${field}`,
        AGENT_RUNTIME_LIMITS.untrustedContextBytes,
        field === 'path' ? 0 : 1,
      );
    }
  }

  validateRequiredContext(selectedTool, context);

  const rawMessages = value.visibleMessages ?? [];
  if (!Array.isArray(rawMessages) || rawMessages.length > 6) {
    invalid('visibleMessages must contain at most six items.');
  }
  const visibleMessages: AgentVisibleMessage[] = rawMessages.map(
    (item, index) => {
      if (!isRecord(item)) {
        invalid(`visibleMessages[${index}] must be an object.`);
      }
      assertNoExtraKeys(item, new Set(['role', 'content']));
      if (item.role !== 'user' && item.role !== 'assistant') {
        invalid(`visibleMessages[${index}].role is invalid.`);
      }
      return {
        role: item.role,
        content: readBoundedString(
          item.content,
          `visibleMessages[${index}].content`,
          AGENT_RUNTIME_LIMITS.untrustedContextBytes,
          1,
        ),
      };
    },
  );

  const untrustedBytes = Buffer.byteLength(
    JSON.stringify({ instruction, context, visibleMessages }),
    'utf8',
  );
  if (untrustedBytes > AGENT_RUNTIME_LIMITS.untrustedContextBytes) {
    invalid('The selected AI context exceeds the 16 KiB UTF-8 limit.');
  }

  return { sessionId, selectedTool, instruction, context, visibleMessages };
}

function validateRequiredContext(
  tool: AgentSelectedTool,
  context: Record<string, string>,
): void {
  const required: Record<AgentSelectedTool, readonly string[]> = {
    formatter: ['input'],
    diff: ['before', 'after'],
    patch: ['document'],
    pointer: ['document'],
  };
  for (const field of required[tool]) {
    if (context[field] === undefined) {
      invalid(`context.${field} is required for ${tool}.`);
    }
  }
}

function readBoundedString(
  value: unknown,
  field: string,
  maximum: number,
  minimum: number,
): string {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum
  ) {
    invalid(
      `${field} must contain between ${minimum} and ${maximum} characters.`,
    );
  }
  return value;
}

function assertNoExtraKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  const extra = Object.keys(value).find((key) => !allowed.has(key));
  if (extra) {
    invalid('The request contains an unexpected field.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new AgentError('INVALID_REQUEST', message);
}
