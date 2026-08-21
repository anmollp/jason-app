export const agentInstructionLimit = 500;
export const agentContextLimitBytes = 16_384;

export type AgentSelectedTool = "formatter" | "diff" | "patch" | "pointer";
export type AgentToolName =
  | "format_json"
  | "diff_json"
  | "apply_json_patch"
  | "resolve_json_pointer";

export type AgentVisibleMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentJsonPatchOperation =
  | { op: "add" | "replace" | "test"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "move" | "copy"; from: string; path: string };

export type AgentProposalDataMap = {
  formatter: { output: string };
  diff: {
    operations: AgentJsonPatchOperation[];
    summary: { changes: number; added: number; removed: number; replaced: number };
  };
  patch: {
    output: string;
    summary: { operations: number; added: number; removed: number; replaced: number };
  };
  pointer: {
    output: string;
    summary: {
      depth: number;
      found: boolean;
      issues: number;
      kind: string;
      path: string;
    };
  };
};

export type AgentSession = {
  sessionId: string;
  expiresAt: string;
  remainingTurns: number;
  remainingToolCalls: number;
};

export type AgentProposal = {
  [Tool in AgentSelectedTool]: {
    tool: Tool;
    data: AgentProposalDataMap[Tool];
    validation: "jason";
  };
}[AgentSelectedTool];

export type AgentEvent =
  | { type: "status"; phase: string; message: string }
  | { type: "tool_call"; tool: AgentToolName }
  | {
      type: "tool_result";
      tool: AgentToolName;
      ok: boolean;
      validation?: string;
    }
  | { type: "message"; delta: string }
  | ({ type: "proposal" } & AgentProposal)
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      estimatedCostMicroUsd: number;
      remainingTurns: number;
      remainingToolCalls: number;
    }
  | { type: "error"; code: string; message: string; retryable: boolean }
  | { type: "done" };

export type AgentMessageRequest = {
  sessionId: string;
  selectedTool: AgentSelectedTool;
  instruction: string;
  context: Record<string, string>;
  visibleMessages: readonly AgentVisibleMessage[];
};

export class AgentClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "AgentClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

export async function issueAgentSession(
  signal: AbortSignal,
): Promise<AgentSession> {
  const response = await fetch("/api/agent/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await responseError(response);
  }

  return parseAgentSession(await response.json());
}

export async function* streamAgentMessage(
  request: AgentMessageRequest,
  signal: AbortSignal,
): AsyncIterable<AgentEvent> {
  const response = await fetch("/api/agent/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await responseError(response);
  }
  if (!response.body) {
    throw new AgentClientError(
      "missing_stream",
      "Jason did not return a response stream.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const parsed = takeCompleteSseBlocks(buffer);
    buffer = parsed.remainder;
    for (const block of parsed.blocks) {
      const event = parseSseEventBlock(block);
      if (event) {
        yield event;
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = parseSseEventBlock(buffer);
    if (event) {
      yield event;
    }
  }
}

export function measureAgentContextBytes(
  instruction: string,
  context: Record<string, string>,
  visibleMessages: readonly AgentVisibleMessage[],
): number {
  return new TextEncoder().encode(
    JSON.stringify({ instruction, context, visibleMessages }),
  ).length;
}

export function patchProposalOutput(
  proposal: AgentProposal | undefined,
): string | undefined {
  return proposal?.tool === "patch" ? proposal.data.output : undefined;
}

export function parseSseEventBlock(block: string): AgentEvent | undefined {
  let eventName = "";
  const data: string[] = [];

  for (const line of block.replaceAll("\r\n", "\n").split("\n")) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (!eventName && data.length === 0) {
    return undefined;
  }
  if (!eventName || data.length === 0) {
    malformedStream();
  }

  let value: unknown;
  try {
    value = JSON.parse(data.join("\n"));
  } catch {
    malformedStream();
  }

  const event = parseAgentEvent(value);
  if (event.type !== eventName) {
    malformedStream();
  }
  return event;
}

function parseAgentSession(value: unknown): AgentSession {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== "string" ||
    typeof value.expiresAt !== "string" ||
    !isNonNegativeNumber(value.remainingTurns) ||
    !isNonNegativeNumber(value.remainingToolCalls)
  ) {
    throw new AgentClientError(
      "invalid_session",
      "Jason returned an invalid session response.",
    );
  }

  return {
    sessionId: value.sessionId,
    expiresAt: value.expiresAt,
    remainingTurns: value.remainingTurns,
    remainingToolCalls: value.remainingToolCalls,
  };
}

function parseAgentEvent(value: unknown): AgentEvent {
  if (!isRecord(value) || typeof value.type !== "string") {
    malformedStream();
  }

  switch (value.type) {
    case "status":
      if (typeof value.phase !== "string" || typeof value.message !== "string") {
        malformedStream();
      }
      return { type: value.type, phase: value.phase, message: value.message };
    case "tool_call":
      if (!isAgentToolName(value.tool)) {
        malformedStream();
      }
      return { type: value.type, tool: value.tool };
    case "tool_result":
      if (
        !isAgentToolName(value.tool) ||
        typeof value.ok !== "boolean" ||
        (value.validation !== undefined && typeof value.validation !== "string")
      ) {
        malformedStream();
      }
      return {
        type: value.type,
        tool: value.tool,
        ok: value.ok,
        ...(value.validation ? { validation: value.validation } : {}),
      };
    case "message":
      if (typeof value.delta !== "string") {
        malformedStream();
      }
      return { type: value.type, delta: value.delta };
    case "proposal":
      if (!isSelectedTool(value.tool) || value.validation !== "jason") {
        malformedStream();
      }
      return {
        type: value.type,
        ...parseProposal(value.tool, value.data),
      };
    case "usage": {
      if (
        !isNonNegativeNumber(value.inputTokens) ||
        !isNonNegativeNumber(value.outputTokens) ||
        !isNonNegativeNumber(value.cachedInputTokens) ||
        !isNonNegativeNumber(value.estimatedCostMicroUsd) ||
        !isNonNegativeNumber(value.remainingTurns) ||
        !isNonNegativeNumber(value.remainingToolCalls)
      ) {
        malformedStream();
      }
      return {
        type: value.type,
        inputTokens: value.inputTokens,
        outputTokens: value.outputTokens,
        cachedInputTokens: value.cachedInputTokens,
        estimatedCostMicroUsd: value.estimatedCostMicroUsd,
        remainingTurns: value.remainingTurns,
        remainingToolCalls: value.remainingToolCalls,
      };
    }
    case "error":
      if (
        typeof value.code !== "string" ||
        typeof value.message !== "string" ||
        typeof value.retryable !== "boolean"
      ) {
        malformedStream();
      }
      return {
        type: value.type,
        code: value.code,
        message: value.message,
        retryable: value.retryable,
      };
    case "done":
      return { type: value.type };
    default:
      malformedStream();
  }
}

function takeCompleteSseBlocks(value: string): {
  blocks: string[];
  remainder: string;
} {
  const blocks: string[] = [];
  let remainder = value;

  while (true) {
    const match = /\r?\n\r?\n/u.exec(remainder);
    if (!match || match.index === undefined) {
      return { blocks, remainder };
    }

    blocks.push(remainder.slice(0, match.index));
    remainder = remainder.slice(match.index + match[0].length);
  }
}

async function responseError(response: Response): Promise<AgentClientError> {
  let message = "The AI copilot is temporarily unavailable.";
  try {
    const value = (await response.json()) as unknown;
    if (isRecord(value) && typeof value.message === "string") {
      message = value.message;
    }
  } catch {
    // Keep the safe generic message for non-JSON upstream failures.
  }
  const normalizedMessage = message.toLowerCase();
  const code =
    response.status === 429
      ? normalizedMessage.includes("budget")
        ? "budget_exhausted"
        : "quota_exhausted"
      : response.status === 503
        ? "agent_unavailable"
        : `http_${response.status}`;
  return new AgentClientError(code, message, response.status >= 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isSelectedTool(value: unknown): value is AgentSelectedTool {
  return (
    value === "formatter" ||
    value === "diff" ||
    value === "patch" ||
    value === "pointer"
  );
}

function isAgentToolName(value: unknown): value is AgentToolName {
  return (
    value === "format_json" ||
    value === "diff_json" ||
    value === "apply_json_patch" ||
    value === "resolve_json_pointer"
  );
}

function parseProposal(
  tool: AgentSelectedTool,
  data: unknown,
): AgentProposal {
  if (!isRecord(data)) {
    malformedStream();
  }

  switch (tool) {
    case "formatter":
      if (!hasOnlyKeys(data, ["output"]) || typeof data.output !== "string") {
        malformedStream();
      }
      return { tool, data: { output: data.output }, validation: "jason" };
    case "diff": {
      const summary = parseCountSummary(data.summary, "changes");
      if (
        !hasOnlyKeys(data, ["operations", "summary"]) ||
        !Array.isArray(data.operations) ||
        !data.operations.every(isJsonPatchOperation)
      ) {
        malformedStream();
      }
      return {
        tool,
        data: { operations: data.operations, summary },
        validation: "jason",
      };
    }
    case "patch": {
      const summary = parseCountSummary(data.summary, "operations");
      if (
        !hasOnlyKeys(data, ["output", "summary"]) ||
        typeof data.output !== "string"
      ) {
        malformedStream();
      }
      return { tool, data: { output: data.output, summary }, validation: "jason" };
    }
    case "pointer":
      if (
        !hasOnlyKeys(data, ["output", "summary"]) ||
        typeof data.output !== "string" ||
        !isRecord(data.summary) ||
        !hasOnlyKeys(data.summary, ["depth", "found", "issues", "kind", "path"]) ||
        !isNonNegativeInteger(data.summary.depth) ||
        typeof data.summary.found !== "boolean" ||
        !isNonNegativeInteger(data.summary.issues) ||
        typeof data.summary.kind !== "string" ||
        typeof data.summary.path !== "string"
      ) {
        malformedStream();
      }
      return {
        tool,
        data: {
          output: data.output,
          summary: {
            depth: data.summary.depth,
            found: data.summary.found,
            issues: data.summary.issues,
            kind: data.summary.kind,
            path: data.summary.path,
          },
        },
        validation: "jason",
      };
  }
}

function parseCountSummary<TotalKey extends "changes" | "operations">(
  value: unknown,
  totalKey: TotalKey,
): Record<TotalKey, number> & {
  added: number;
  removed: number;
  replaced: number;
} {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [totalKey, "added", "removed", "replaced"]) ||
    !isNonNegativeInteger(value[totalKey]) ||
    !isNonNegativeInteger(value.added) ||
    !isNonNegativeInteger(value.removed) ||
    !isNonNegativeInteger(value.replaced)
  ) {
    malformedStream();
  }

  return {
    [totalKey]: value[totalKey],
    added: value.added,
    removed: value.removed,
    replaced: value.replaced,
  } as Record<TotalKey, number> & {
    added: number;
    removed: number;
    replaced: number;
  };
}

function isJsonPatchOperation(value: unknown): value is AgentJsonPatchOperation {
  if (
    !isRecord(value) ||
    typeof value.op !== "string" ||
    typeof value.path !== "string"
  ) {
    return false;
  }

  switch (value.op) {
    case "add":
    case "replace":
    case "test":
      return (
        hasOnlyKeys(value, ["op", "path", "value"]) &&
        Object.hasOwn(value, "value")
      );
    case "remove":
      return hasOnlyKeys(value, ["op", "path"]);
    case "move":
    case "copy":
      return (
        hasOnlyKeys(value, ["op", "from", "path"]) &&
        typeof value.from === "string"
      );
    default:
      return false;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function malformedStream(): never {
  throw new AgentClientError(
    "malformed_stream",
    "Jason returned an invalid response stream.",
  );
}
