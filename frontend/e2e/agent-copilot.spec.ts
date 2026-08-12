import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type AgentRequest = {
  selectedTool: "formatter" | "diff" | "patch" | "pointer";
  context: Record<string, string>;
  visibleMessages: Array<{ role: string; content: string }>;
};

const toolNames = {
  formatter: "format_json",
  diff: "diff_json",
  patch: "apply_json_patch",
  pointer: "resolve_json_pointer",
} as const;

test("sends only the selected bounded context for all four tools", async ({
  page,
}) => {
  const requests: AgentRequest[] = [];
  await mockAgent(page, { requests });

  for (const tool of ["formatter", "diff", "patch", "pointer"] as const) {
    await page.goto("/playground");
    if (tool !== "formatter") {
      await page.getByRole("button", { name: titleCase(tool), exact: true }).click();
    }
    await askJason(page, `Help with ${tool}.`);
    await expect(page.getByRole("heading", { name: "Proposal ready" })).toBeVisible();
  }

  expect(requests.map((request) => request.selectedTool)).toEqual([
    "formatter",
    "diff",
    "patch",
    "pointer",
  ]);
  expect(Object.keys(requests[0].context)).toEqual(["input"]);
  expect(Object.keys(requests[1].context).sort()).toEqual(["after", "before"]);
  expect(Object.keys(requests[2].context).sort()).toEqual(["document", "patch"]);
  expect(Object.keys(requests[3].context).sort()).toEqual(["document", "path"]);
  expect(requests.every((request) => request.visibleMessages.length === 0)).toBe(true);
});

test("Patch proposals require Apply and Discard never changes the workspace", async ({
  page,
}) => {
  const requests: AgentRequest[] = [];
  await mockAgent(page, { requests });
  await page.goto("/playground");
  await page.getByRole("button", { name: "Patch", exact: true }).click();

  const documentEditor = page.getByLabel("Document JSON");
  const originalDocument = await documentEditor.textContent();

  await askJason(page, "Set retries to 5 and remove debug.");
  await expect(page.getByRole("heading", { name: "Proposal ready" })).toBeVisible();
  await expect(documentEditor).toHaveText(originalDocument ?? "");
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("heading", { name: "Proposal ready" })).toHaveCount(0);
  await expect(documentEditor).toHaveText(originalDocument ?? "");

  await askJason(page, "Set retries to 5 and remove debug.");
  await page.getByRole("button", { name: "Apply to workspace" }).click();
  await expect(documentEditor).toContainText('"retries": 5');
  await expect(documentEditor).not.toContainText('"debug"');
  expect(JSON.stringify(requests.at(-1)?.visibleMessages)).not.toContain(
    '"service"',
  );
});

test("missing inputs and oversized AI context do not consume a session", async ({
  page,
}) => {
  const requests: AgentRequest[] = [];
  let sessionRequests = 0;
  await mockAgent(page, {
    requests,
    onSession: () => {
      sessionRequests += 1;
    },
  });
  await page.goto("/playground");

  const editor = page.getByLabel("Input JSON");
  await editor.fill("");
  await askJason(page, "Explain this input.");
  await expect(page.getByText("Paste the JSON you want Jason to format or explain.")).toBeVisible();
  expect(sessionRequests).toBe(0);

  await page.getByRole("button", { name: "Close Jason copilot" }).last().click();
  await editor.fill(`{"payload":"${"x".repeat(17_000)}"}`);
  await askJason(page, "Format this input.");
  await expect(page.getByText(/selected AI context exceeds 16 KB/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Format", exact: true })).toBeEnabled();
  expect(sessionRequests).toBe(0);
  expect(requests).toHaveLength(0);
});

test("renders a focused model clarification without a speculative tool call", async ({
  page,
}) => {
  await mockAgent(page, {
    events: [
      {
        type: "message",
        delta: "Which account field should I resolve?",
      },
      usageEvent(),
      { type: "done" },
    ],
  });
  await page.goto("/playground");
  await askJason(page, "Find the account value.");

  await expect(page.getByText("Which account field should I resolve?")).toBeVisible();
  await expect(page.getByLabel("Agent tool trace")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Proposal ready" })).toHaveCount(0);
});

for (const state of [
  {
    name: "moderation",
    event: {
      type: "error",
      code: "moderation_blocked",
      message: "The instruction could not be processed safely.",
      retryable: false,
    },
    heading: "Instruction blocked",
  },
  {
    name: "timeout",
    event: {
      type: "error",
      code: "request_timeout",
      message: "The AI request timed out.",
      retryable: true,
    },
    heading: "60-second limit",
  },
  {
    name: "upstream failure",
    event: {
      type: "error",
      code: "provider_unavailable",
      message: "The model provider is temporarily unavailable.",
      retryable: true,
    },
    heading: "Jason could not complete this request",
  },
] as const) {
  test(`preserves deterministic tools during ${state.name}`, async ({ page }) => {
    await mockAgent(page, { events: [state.event, usageEvent(), { type: "done" }] });
    await page.goto("/playground");
    await askJason(page, "Format this safely.");

    await expect(page.getByRole("heading", { name: state.heading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Format", exact: true })).toBeEnabled();
  });
}

test("shows quota exhaustion and graceful feature unavailability", async ({ page }) => {
  await mockAgent(page, {
    sessionResponse: {
      status: 429,
      body: { message: "The daily guided-session quota is exhausted." },
    },
  });
  await page.goto("/playground");
  await askJason(page, "Format this safely.");
  await expect(page.getByRole("heading", { name: "AI turns exhausted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Format", exact: true })).toBeEnabled();

  await page.reload();
  await page.unrouteAll();
  await mockAgent(page, {
    sessionResponse: {
      status: 503,
      body: { message: "The AI copilot is temporarily unavailable." },
    },
  });
  await askJason(page, "Format this safely.");
  await expect(
    page.getByRole("heading", { name: "Jason could not complete this request" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Format", exact: true })).toBeEnabled();
});

test("uses an accessible mobile bottom sheet and restores launcher focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAgent(page);
  await page.goto("/playground");
  const launcher = page.getByRole("button", { name: "Ask Jason" });
  await launcher.click();

  const dialog = page.getByRole("dialog", { name: "Jason" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBe(390);
  expect(bounds?.y).toBeGreaterThan(150);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();
});

test("has no serious accessibility violations on AI surfaces", async ({ page }) => {
  await mockAgent(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Keep control of the JSON/i })).toBeVisible();
  await assertAccessible(page, "#ai");

  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await assertAccessible(page, "main");

  await page.goto("/playground");
  await page.getByRole("button", { name: "Ask Jason" }).click();
  await assertAccessible(page, '[role="dialog"]');
});

async function askJason(page: Page, instruction: string) {
  const dialog = page.getByRole("dialog", { name: "Jason" });
  if (!(await dialog.isVisible())) {
    await page.getByRole("button", { name: "Ask Jason" }).click();
  }
  await page.getByLabel("Ask Jason about the selected JSON").fill(instruction);
  await page.getByRole("button", { name: "Send" }).click();
}

async function mockAgent(
  page: Page,
  options: {
    events?: readonly Record<string, unknown>[];
    onSession?: () => void;
    requests?: AgentRequest[];
    sessionResponse?: { status: number; body: Record<string, unknown> };
  } = {},
) {
  await page.route("**/api/agent/session", async (route) => {
    options.onSession?.();
    if (options.sessionResponse) {
      await route.fulfill({
        status: options.sessionResponse.status,
        contentType: "application/json",
        body: JSON.stringify(options.sessionResponse.body),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "s".repeat(32),
        expiresAt: "2026-08-13T12:00:00.000Z",
        remainingTurns: 3,
        remainingToolCalls: 4,
      }),
    });
  });

  await page.route("**/api/agent/message", async (route) => {
    const request = route.request().postDataJSON() as AgentRequest;
    options.requests?.push(request);
    const events = options.events ?? successfulEvents(request.selectedTool);
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-store" },
      body: events
        .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });
}

function successfulEvents(tool: AgentRequest["selectedTool"]) {
  const toolName = toolNames[tool];
  return [
    { type: "status", phase: "moderating", message: "Checking the instruction." },
    { type: "tool_call", tool: toolName },
    { type: "tool_result", tool: toolName, ok: true, validation: "jason" },
    {
      type: "proposal",
      tool,
      data: proposalData(tool),
      validation: "jason",
    },
    { type: "message", delta: "Jason prepared a Rust-valid result." },
    usageEvent(),
    { type: "done" },
  ];
}

function proposalData(tool: AgentRequest["selectedTool"]) {
  switch (tool) {
    case "formatter":
      return { output: "{\n  \"ok\": true\n}" };
    case "diff":
      return {
        operations: [{ op: "replace", path: "/retries", value: 5 }],
        summary: { changes: 1, added: 0, removed: 0, replaced: 1 },
      };
    case "patch":
      return {
        output: '{\n  "service": "checkout-api",\n  "retries": 5\n}',
        summary: { operations: 2, added: 0, removed: 1, replaced: 1 },
      };
    case "pointer":
      return {
        output: '"Administrator"',
        summary: {
          depth: 2,
          found: true,
          issues: 0,
          kind: "string",
          path: "/user/role",
        },
      };
  }
}

function usageEvent() {
  return {
    type: "usage",
    inputTokens: 100,
    outputTokens: 20,
    cachedInputTokens: 0,
    estimatedCostMicroUsd: 44,
    remainingTurns: 2,
    remainingToolCalls: 3,
  };
}

async function assertAccessible(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

function titleCase(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
