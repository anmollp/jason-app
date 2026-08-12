import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentClientError,
  agentContextLimitBytes,
  issueAgentSession,
  measureAgentContextBytes,
  parseSseEventBlock,
  patchProposalOutput,
  streamAgentMessage,
} from "./agent-client.ts";

test("parses only matching, schema-valid SSE events", () => {
  assert.deepEqual(
    parseSseEventBlock(
      'event: tool_result\ndata: {"type":"tool_result","tool":"format_json","ok":true,"validation":"jason"}',
    ),
    {
      type: "tool_result",
      tool: "format_json",
      ok: true,
      validation: "jason",
    },
  );

  assert.throws(
    () =>
      parseSseEventBlock(
        'event: message\ndata: {"type":"proposal","tool":"patch","data":{},"validation":"jason"}',
      ),
    AgentClientError,
  );
  assert.throws(
    () => parseSseEventBlock("event: message\ndata: not-json"),
    AgentClientError,
  );
});

test("streams events correctly when SSE boundaries span chunks", async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: status\ndata: {"type":"status","phase":"thinking",',
            ),
          );
          controller.enqueue(
            encoder.encode(
              '"message":"Routing safely."}\n\nevent: done\ndata: {"type":"done"}\n\n',
            ),
          );
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );

  try {
    const events = [];
    for await (const event of streamAgentMessage(
      {
        sessionId: "session",
        selectedTool: "formatter",
        instruction: "Format this.",
        context: { input: "{}" },
        visibleMessages: [],
      },
      new AbortController().signal,
    )) {
      events.push(event);
    }

    assert.deepEqual(events, [
      { type: "status", phase: "thinking", message: "Routing safely." },
      { type: "done" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects malformed session responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ sessionId: "missing fields" });

  try {
    await assert.rejects(
      issueAgentSession(new AbortController().signal),
      AgentClientError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("marks transient session failures as retryable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      { message: "The AI copilot is temporarily unavailable." },
      { status: 503 },
    );

  try {
    await assert.rejects(
      issueAgentSession(new AbortController().signal),
      (error) => error instanceof AgentClientError && error.retryable,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("measures the complete untrusted AI payload independently of 5 MB tools", () => {
  const bytes = measureAgentContextBytes(
    "Explain this.",
    { input: "x".repeat(agentContextLimitBytes) },
    [],
  );

  assert.ok(bytes > agentContextLimitBytes);
});

test("exposes only a Patch proposal output for explicit application", () => {
  assert.equal(
    patchProposalOutput({
      tool: "patch",
      validation: "jason",
      data: { output: "{}" },
    }),
    "{}",
  );
  assert.equal(
    patchProposalOutput({
      tool: "formatter",
      validation: "jason",
      data: { output: "{}" },
    }),
    undefined,
  );
});
