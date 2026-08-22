"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AgentClientError,
  agentContextLimitBytes,
  agentInstructionLimit,
  issueAgentSession,
  measureAgentContextBytes,
  streamAgentMessage,
  type AgentEvent,
  type AgentProposal,
  type AgentSelectedTool,
  type AgentSession,
  type AgentToolName,
  type AgentVisibleMessage,
} from "./agent-client";

export type AgentConversationMessage = AgentVisibleMessage & {
  id: number;
};

export type AgentTraceItem = {
  id: number;
  type: "status" | "tool_call" | "tool_result";
  label: string;
  message: string;
  tone: "info" | "success";
};

export type AgentDisplayError = {
  code: string;
  message: string;
  retryable: boolean;
};

type StoredMessage = AgentConversationMessage & {
  tool: AgentSelectedTool;
};

type StoredTraceItem = AgentTraceItem & {
  tool: AgentSelectedTool;
};

type StoredProposal = {
  contextKey: string;
  proposal: AgentProposal;
  tool: AgentSelectedTool;
};

type StoredError = {
  error: AgentDisplayError;
  tool: AgentSelectedTool;
};

type UseAgentCopilotInput = {
  selectedTool: AgentSelectedTool;
  context: Record<string, string>;
};

const expectedTool: Record<AgentSelectedTool, AgentToolName> = {
  formatter: "format_json",
  diff: "diff_json",
  patch: "apply_json_patch",
  pointer: "resolve_json_pointer",
};

export function useAgentCopilot({
  selectedTool,
  context,
}: UseAgentCopilotInput) {
  const [session, setSession] = useState<AgentSession>();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [trace, setTrace] = useState<StoredTraceItem[]>([]);
  const [storedProposal, setStoredProposal] = useState<StoredProposal>();
  const [storedError, setStoredError] = useState<StoredError>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const nextId = useRef(1);
  const contextKey = JSON.stringify(context);
  const contextBytes = new TextEncoder().encode(contextKey).length;

  const displayMessages = useMemo(
    () => messages.filter((message) => message.tool === selectedTool),
    [messages, selectedTool],
  );
  const displayTrace = useMemo(
    () => trace.filter((item) => item.tool === selectedTool),
    [selectedTool, trace],
  );
  const proposal =
    storedProposal?.tool === selectedTool &&
    storedProposal.contextKey === contextKey
      ? storedProposal.proposal
      : undefined;
  const error =
    storedError?.tool === selectedTool ? storedError.error : undefined;

  useEffect(() => {
    activeRequest.current?.abort();
  }, [selectedTool]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  async function submit(rawInstruction: string) {
    const instruction = rawInstruction.trim();
    if (!instruction || isSubmitting) {
      return;
    }
    if (instruction.length > agentInstructionLimit) {
      setLocalError(
        "instruction_too_long",
        `Keep the instruction within ${agentInstructionLimit} characters.`,
      );
      return;
    }

    const missingInput = missingInputMessage(selectedTool, context);
    if (missingInput) {
      appendMessage("assistant", missingInput);
      clearCurrentResult();
      return;
    }

    const visibleMessages = fitVisibleMessages(
      displayMessages,
      instruction,
      context,
    );
    if (
      measureAgentContextBytes(instruction, context, visibleMessages) >
      agentContextLimitBytes
    ) {
      setLocalError(
        "context_too_large",
        "The selected AI context exceeds 16 KB. The deterministic tool still supports documents up to 5 MB.",
      );
      return;
    }

    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setIsSubmitting(true);
    clearCurrentResult();
    appendMessage("user", instruction);

    try {
      const activeSession = session ?? (await issueAgentSession(controller.signal));
      if (!session) {
        setSession(activeSession);
      }

      for await (const event of streamAgentMessage(
        {
          sessionId: activeSession.sessionId,
          selectedTool,
          instruction,
          context,
          visibleMessages,
        },
        controller.signal,
      )) {
        handleEvent(event, selectedTool);
      }
    } catch (caught) {
      if (!isAbortError(caught)) {
        const normalized = normalizeError(caught);
        setStoredError({ error: normalized, tool: selectedTool });
        setStoredProposal(undefined);
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = undefined;
        setIsSubmitting(false);
      }
    }
  }

  function handleEvent(event: AgentEvent, tool: AgentSelectedTool) {
    switch (event.type) {
      case "status":
        appendTrace({
          type: event.type,
          label: event.phase,
          message: event.message,
          tone: "info",
        });
        return;
      case "tool_call":
        assertExpectedTool(tool, event.tool);
        appendTrace({
          type: event.type,
          label: "tool_call",
          message: event.tool,
          tone: "success",
        });
        return;
      case "tool_result":
        assertExpectedTool(tool, event.tool);
        appendTrace({
          type: event.type,
          label: "tool_result",
          message: event.ok
            ? "Rust validation passed · proposal only"
            : "Rust validation rejected the result",
          tone: event.ok ? "success" : "info",
        });
        return;
      case "message":
        appendAssistantDelta(event.delta);
        return;
      case "proposal":
        if (event.tool !== tool) {
          throw new AgentClientError(
            "tool_mismatch",
            "Jason returned a proposal for the wrong workspace tool.",
          );
        }
        setStoredProposal({
          contextKey,
          tool,
          proposal: proposalFromEvent(event),
        });
        return;
      case "usage":
        setSession((current) =>
          current
            ? {
                ...current,
                remainingTurns: event.remainingTurns,
                remainingToolCalls: event.remainingToolCalls,
              }
            : current,
        );
        return;
      case "error":
        setStoredError({
          tool,
          error: {
            code: event.code,
            message: event.message,
            retryable: event.retryable,
          },
        });
        setStoredProposal(undefined);
        return;
      case "done":
        return;
    }
  }

  function appendMessage(role: AgentVisibleMessage["role"], content: string) {
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role, content, tool: selectedTool },
    ]);
  }

  function appendAssistantDelta(delta: string) {
    setMessages((current) => {
      const last = current.at(-1);
      if (last?.role === "assistant" && last.tool === selectedTool) {
        return current.map((message) =>
          message.id === last.id
            ? { ...message, content: message.content + delta }
            : message,
        );
      }
      return [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          content: delta,
          tool: selectedTool,
        },
      ];
    });
  }

  function appendTrace(item: Omit<AgentTraceItem, "id">) {
    setTrace((current) => [
      ...current,
      { id: nextId.current++, tool: selectedTool, ...item },
    ]);
  }

  function setLocalError(code: string, message: string) {
    setStoredError({
      tool: selectedTool,
      error: { code, message, retryable: false },
    });
    setTrace((current) =>
      current.filter((item) => item.tool !== selectedTool),
    );
    setStoredProposal(undefined);
  }

  function discardProposal() {
    setStoredProposal(undefined);
  }

  function markProposalApplied() {
    setStoredProposal(undefined);
    appendMessage(
      "assistant",
      "Applied after your approval. The deterministic Patch workflow remains available.",
    );
  }

  function cancel() {
    activeRequest.current?.abort();
  }

  function clearCurrentResult() {
    setTrace((current) =>
      current.filter((item) => item.tool !== selectedTool),
    );
    setStoredProposal(undefined);
    setStoredError(undefined);
  }

  return {
    cancel,
    contextBytes,
    discardProposal,
    error,
    isSubmitting,
    markProposalApplied,
    messages: displayMessages,
    proposal,
    remainingTurns: session?.remainingTurns ?? 3,
    submit,
    trace: displayTrace,
  };
}

function proposalFromEvent(
  event: Extract<AgentEvent, { type: "proposal" }>,
): AgentProposal {
  switch (event.tool) {
    case "formatter":
      return { tool: event.tool, data: event.data, validation: event.validation };
    case "diff":
      return { tool: event.tool, data: event.data, validation: event.validation };
    case "patch":
      return { tool: event.tool, data: event.data, validation: event.validation };
    case "pointer":
      return { tool: event.tool, data: event.data, validation: event.validation };
  }
}

function fitVisibleMessages(
  messages: readonly AgentConversationMessage[],
  instruction: string,
  context: Record<string, string>,
): AgentVisibleMessage[] {
  const visible = messages.slice(-6).map(({ role, content }) => ({
    role,
    content,
  }));

  while (
    visible.length > 0 &&
    measureAgentContextBytes(instruction, context, visible) >
      agentContextLimitBytes
  ) {
    visible.shift();
  }
  return visible;
}

function missingInputMessage(
  tool: AgentSelectedTool,
  context: Record<string, string>,
): string | undefined {
  if (tool === "formatter" && !context.input?.trim()) {
    return "Paste the JSON you want Jason to format or explain.";
  }
  if (tool === "diff") {
    if (!context.before?.trim()) {
      return "Paste the original JSON in the Before editor first.";
    }
    if (!context.after?.trim()) {
      return "Paste the comparison JSON in the Changed editor first.";
    }
  }
  if (tool === "patch" && !context.document?.trim()) {
    return "Paste the JSON document you want Jason to change.";
  }
  if (tool === "pointer" && !context.document?.trim()) {
    return "Paste the JSON document you want Jason to inspect.";
  }
  return undefined;
}

function assertExpectedTool(
  selectedTool: AgentSelectedTool,
  actualTool: AgentToolName,
) {
  if (expectedTool[selectedTool] !== actualTool) {
    throw new AgentClientError(
      "tool_mismatch",
      "Jason requested a tool outside the selected workspace context.",
    );
  }
}

function normalizeError(error: unknown): AgentDisplayError {
  if (error instanceof AgentClientError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }
  return {
    code: "agent_unavailable",
    message: "The AI copilot is temporarily unavailable.",
    retryable: true,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
