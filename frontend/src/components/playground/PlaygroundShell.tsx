"use client";

import Link from "next/link";
import { useState } from "react";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs } from "./ToolTabs";

const initialInputJson = `{
  "service": "billing",
  "region": "us-east-1",
  "retry": true
}`;
const formatEndpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"}/format`;

type FormatterState = "idle" | "thinking" | "success" | "error";

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

export function PlaygroundShell() {
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
    if (!outputJson.trim()) {
      return;
    }

    void navigator.clipboard?.writeText(outputJson);
    setCopyMessage("Copied formatted JSON.");
  }

  const outputCode =
    (parseError ? `Jason couldn't parse this JSON.\n\n${parseError}` : outputJson) ||
    "Formatted JSON will appear here.";
  const isFormatting = state === "thinking";
  const canFormat = inputJson.trim().length > 0 && !isFormatting;
  const canCopy = Boolean(outputJson.trim());
  const copyLabel = state === "error" ? "Fix first" : "Copy";
  const errorLine = state === "error" ? parseErrorLine(parseError) : undefined;
  const statusDetail =
    copyMessage ||
    (state === "thinking"
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
    (state === "thinking"
      ? "Jason is formatting..."
      : state === "error"
        ? "Jason couldn't parse this JSON."
        : undefined);
  const footerHint =
    state === "thinking"
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
              Format, diff, patch, and inspect JSON.
            </h1>
          </div>
          <JasonStatus detail={statusDetail} title={statusTitle} tone={state} />
        </section>

        <ToolTabs />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
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
            code={outputCode}
            tone={state === "error" ? "error" : outputJson ? "success" : "default"}
          />
          <InspectorPanel
            canCopy={canCopy}
            copyLabel={copyLabel}
            issues={state === "error" ? 1 : 0}
            keys={keyCount}
            lines={countLines(outputJson || inputJson)}
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
              disabled={!canFormat}
              onClick={() => {
                void handleFormat();
              }}
            >
              {isFormatting ? "Formatting..." : "Format"}
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
