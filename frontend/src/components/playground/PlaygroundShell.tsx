"use client";

import Link from "next/link";
import { useState } from "react";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs, type PlaygroundTool } from "./ToolTabs";

const initialInputJson = `{
  "service": "billing",
  "region": "us-east-1",
  "retry": true
}`;
const diffPatchPreview = `[
  { "op": "replace", "path": "/status", "value": "ready" },
  { "op": "replace", "path": "/plan", "value": "pro" },
  { "op": "replace", "path": "/user/role", "value": "admin" },
  { "op": "add", "path": "/timeoutMs", "value": 3000 }
]`;
const formatEndpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"}/format`;

type FormatterState = "idle" | "thinking" | "success" | "error";
type DiffRow = {
  code: string;
  line: number;
  marker?: "+" | "-" | "~";
  tone?: "neutral" | "add" | "remove" | "change";
};

type FormatJsonResponse = {
  output: string;
};

type FormatJsonErrorResponse = {
  detail?: string;
  message?: string;
};

function countJsonKeys(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countJsonKeys(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce(
      (count, [, child]) => count + 1 + countJsonKeys(child),
      0,
    );
  }

  return 0;
}

function countLines(value: string) {
  return value.trim() ? value.split(/\r?\n/).length : 0;
}

function parseErrorLine(message: string) {
  const match = message.match(/\bline\s+(\d+)\b/i);
  const line = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(line) && line > 0 ? line : undefined;
}

const originalDiffRows: DiffRow[] = [
  { code: "{", line: 1 },
  { code: '"status": "draft",', line: 2, marker: "-", tone: "remove" },
  { code: '"plan": "starter",', line: 3, marker: "-", tone: "remove" },
  { code: '"user": {', line: 4 },
  { code: '  "role": "viewer"', line: 5, marker: "-", tone: "remove" },
  { code: "}", line: 6 },
  { code: "}", line: 7 },
];

const changedDiffRows: DiffRow[] = [
  { code: "{", line: 1 },
  { code: '"status": "ready",', line: 2, marker: "+", tone: "add" },
  { code: '"plan": "pro",', line: 3, marker: "+", tone: "add" },
  { code: '"user": {', line: 4 },
  { code: '  "role": "admin"', line: 5, marker: "+", tone: "add" },
  { code: "},", line: 6, marker: "~", tone: "change" },
  { code: '"timeoutMs": 3000', line: 7, marker: "+", tone: "add" },
  { code: "}", line: 8 },
];

export function PlaygroundShell() {
  const [activeTool, setActiveTool] = useState<PlaygroundTool>("Formatter");
  const [inputJson, setInputJson] = useState(initialInputJson);
  const [outputJson, setOutputJson] = useState("");
  const [parseError, setParseError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [keyCount, setKeyCount] = useState(0);
  const [state, setState] = useState<FormatterState>("idle");

  function handleInputChange(value: string) {
    setInputJson(value);
    setOutputJson("");
    setParseError("");
    setCopyMessage("");
    setKeyCount(0);
    setState("idle");
  }

  function handleToolChange(tool: PlaygroundTool) {
    setActiveTool(tool);
    setCopyMessage("");
  }

  async function handleFormat() {
    if (!inputJson.trim() || state === "thinking") {
      setOutputJson("");
      setParseError("");
      setCopyMessage("");
      setKeyCount(0);
      setState("idle");
      return;
    }

    try {
      setState("thinking");
      setOutputJson("");
      setParseError("");
      setCopyMessage("");

      const response = await fetch(formatEndpoint, {
        body: JSON.stringify({ input: inputJson }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as
        | FormatJsonResponse
        | FormatJsonErrorResponse;

      if (!response.ok) {
        const errorResponse = data as FormatJsonErrorResponse;

        throw new Error(
          errorResponse.detail ??
            errorResponse.message ??
            "Jason could not parse this JSON.",
        );
      }

      const formattedOutput = (data as FormatJsonResponse).output;

      if (typeof formattedOutput !== "string") {
        throw new Error("Formatter returned an unexpected response.");
      }

      const parsed = JSON.parse(formattedOutput) as unknown;

      setOutputJson(formattedOutput);
      setParseError("");
      setCopyMessage("");
      setKeyCount(countJsonKeys(parsed));
      setState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Jason could not parse this JSON.";
      setOutputJson("");
      setParseError(message);
      setCopyMessage("");
      setKeyCount(0);
      setState("error");
    }
  }

  function handleClear() {
    setInputJson("");
    setOutputJson("");
    setParseError("");
    setCopyMessage("");
    setKeyCount(0);
    setState("idle");
  }

  function handleCopy() {
    if (activeTool === "Diff") {
      void navigator.clipboard?.writeText(diffPatchPreview);
      setCopyMessage("Copied patch preview.");
      return;
    }

    if (!outputJson.trim()) {
      return;
    }

    void navigator.clipboard?.writeText(outputJson);
    setCopyMessage("Copied formatted JSON.");
  }

  const outputCode =
    (parseError ? `Jason couldn't parse this JSON.\n\n${parseError}` : outputJson) ||
    "Formatted JSON will appear here.";
  const isDiff = activeTool === "Diff";
  const isUnsupportedTool = activeTool === "Patch" || activeTool === "Pointer";
  const isFormatting = state === "thinking";
  const canRunPrimaryAction =
    isDiff || (inputJson.trim().length > 0 && !isFormatting && !isUnsupportedTool);
  const canCopy = isDiff || Boolean(outputJson.trim());
  const copyLabel = isDiff ? "Patch" : state === "error" ? "Fix first" : "Copy";
  const errorLine = state === "error" ? parseErrorLine(parseError) : undefined;
  const formatterStats = [
    { label: "Lines", value: countLines(outputJson || inputJson) },
    { label: "Keys", value: keyCount },
    {
      label: "Issues",
      tone: state === "error" ? "danger" : "success",
      value: state === "error" ? 1 : 0,
    },
  ] satisfies Parameters<typeof InspectorPanel>[0]["stats"];
  const diffStats = [
    { label: "Changes", value: 3 },
    { label: "Added", tone: "success", value: "+4" },
    { label: "Removed", tone: "danger", value: "-3" },
    { label: "Review", tone: "warning", value: 1 },
  ] satisfies Parameters<typeof InspectorPanel>[0]["stats"];
  const statusDetail =
    copyMessage ||
    (isDiff
      ? "Review highlighted changes before exporting a patch."
      : isUnsupportedTool
        ? `${activeTool} shell is coming next.`
        : state === "thinking"
      ? "Sending JSON to the backend formatter endpoint."
      : state === "error"
      ? parseError
      : state === "success"
        ? "Output is formatted and ready to copy."
        : inputJson.trim()
          ? "Jason is ready to format this JSON."
          : "Paste some JSON to wake Jason.");
  const statusTitle =
    (copyMessage ? "Copied to clipboard." : undefined) ||
    (isDiff
      ? "Jason found 3 changes"
      : isUnsupportedTool
        ? `${activeTool} is not wired yet.`
        : state === "thinking"
      ? "Jason is formatting..."
      : state === "error"
        ? "Jason couldn't parse this JSON."
        : undefined);
  const footerHint =
    isDiff
      ? "Diff shell: highlighted rows show added, removed, and structural changes to review."
      : isUnsupportedTool
        ? "This tool mode will reuse the same playground shell once designed."
        : state === "thinking"
      ? "Calling POST /format on the backend."
      : state === "error"
      ? "Fix the parse issue, then press Cmd/Ctrl + Enter to format again."
      : state === "success"
        ? "Formatted output is ready. Copy it or keep editing the input."
        : "Paste JSON, then run Format or press Cmd/Ctrl + Enter.";

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <JasonLogo size={34} />
            <span className="font-mono text-xl font-semibold">Jason</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Button href="/" variant="secondary" className="hidden sm:inline-flex">
              Landing
            </Button>
            <Button
              href="https://github.com/anmollp/jason"
              variant="secondary"
              className="hidden sm:inline-flex"
            >
              GitHub
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold uppercase text-emerald-400">
              JSON workspace
            </p>
            <h1 className="mt-3 max-w-[760px] text-4xl font-bold tracking-tight sm:text-5xl">
              {isDiff
                ? "Compare JSON changes before they ship."
                : "Format, diff, patch, and inspect JSON."}
            </h1>
          </div>
          <JasonStatus
            detail={statusDetail}
            title={statusTitle}
            tone={isDiff ? "success" : state}
          />
        </section>

        <ToolTabs activeTool={activeTool} onToolChange={handleToolChange} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
          {isDiff ? (
            <>
              <CodePanel
                title="Original JSON"
                meta="before"
                code=""
                diffRows={originalDiffRows}
                tone="error"
              />
              <CodePanel
                title="Changed JSON"
                meta="after"
                code=""
                diffRows={changedDiffRows}
                tone="success"
              />
            </>
          ) : (
            <>
              <CodePanel
                title="Input JSON"
                meta={errorLine ? `line ${errorLine}` : "editable"}
                code={inputJson}
                editable
                errorLine={errorLine}
                onChange={handleInputChange}
                onSubmit={() => {
                  void handleFormat();
                }}
                showLineNumbers
                tone={errorLine ? "error" : "default"}
              />
              <CodePanel
                title="Formatted Output"
                meta={
                  state === "thinking"
                    ? "formatting"
                    : state === "error"
                      ? "parse error"
                      : outputJson
                        ? "formatted"
                        : "waiting"
                }
                code={isUnsupportedTool ? `${activeTool} shell coming soon.` : outputCode}
                tone={state === "error" ? "error" : outputJson ? "success" : "default"}
              />
            </>
          )}
          <InspectorPanel
            canCopy={canCopy}
            copyLabel={copyLabel}
            stats={isDiff ? diffStats : formatterStats}
            onClear={handleClear}
            onCopy={handleCopy}
          />
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-zinc-400">
            {footerHint}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!canRunPrimaryAction}
              onClick={() => {
                if (isDiff) {
                  setCopyMessage("Diff preview is ready.");
                  return;
                }

                void handleFormat();
              }}
            >
              {isDiff ? "Compare" : isFormatting ? "Formatting..." : "Format"}
            </Button>
            <Button disabled={!canCopy} variant="secondary" onClick={handleCopy}>
              {copyLabel}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
