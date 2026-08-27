import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentClientError,
  agentContextLimitBytes,
  issueAgentSession,
  measureAgentContextBytes,
  parseSseEventBlock,
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

test("validates proposal data for every workspace tool", () => {
  const proposals = [
    ["formatter", { output: "{}" }],
    [
      "diff",
      {
        operations: [
          { op: "add", path: "/added", value: true },
          { op: "remove", path: "/removed" },
          { op: "replace", path: "/a", value: 2 },
          { op: "move", from: "/from", path: "/moved" },
          { op: "copy", from: "/from", path: "/copied" },
          { op: "test", path: "/a", value: 2 },
        ],
        summary: { changes: 6, added: 1, removed: 1, replaced: 1 },
      },
    ],
    [
      "patch",
      {
        operations: [{ op: "replace", path: "/a", value: 2 }],
        output: '{"a":2}',
        summary: { operations: 1, added: 0, removed: 0, replaced: 1 },
      },
    ],
    [
      "pointer",
      {
        output: "2",
        summary: { depth: 1, found: true, issues: 0, kind: "number", path: "/a" },
      },
    ],
  ];

  for (const [tool, data] of proposals) {
    assert.deepEqual(
      parseSseEventBlock(
        `event: proposal\ndata: ${JSON.stringify({ type: "proposal", tool, data, validation: "jason" })}`,
      ),
      { type: "proposal", tool, data, validation: "jason" },
    );
  }

  const invalidProposals = [
    ["formatter", { output: 42 }],
    [
      "diff",
      {
        operations: [{ op: "add", path: "/a" }],
        summary: { changes: 1, added: 0, removed: 0, replaced: 1 },
      },
    ],
    [
      "diff",
      {
        operations: [{ op: "move", path: "/a" }],
        summary: { changes: 1, added: 0, removed: 0, replaced: 1 },
      },
    ],
    [
      "diff",
      {
        operations: [{ op: "remove", path: "/a", value: 1 }],
        summary: { changes: 1, added: 0, removed: 0, replaced: 1 },
      },
    ],
    [
      "patch",
      {
        operations: [{ op: "replace", path: "/a", value: 2 }],
        output: "{}",
        summary: { operations: 1, added: 0, removed: 0, replaced: 1, extra: 1 },
      },
    ],
    [
      "pointer",
      {
        output: "2",
        summary: { depth: -1, found: true, issues: 0, kind: "number", path: "/a" },
      },
    ],
  ];

  for (const [tool, data] of invalidProposals) {
    assert.throws(
      () =>
        parseSseEventBlock(
          `event: proposal\ndata: ${JSON.stringify({ type: "proposal", tool, data, validation: "jason" })}`,
        ),
      AgentClientError,
    );
  }
});
