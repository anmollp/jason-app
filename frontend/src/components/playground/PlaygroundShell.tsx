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

type FormatterState = "idle" | "success" | "error";

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

export function PlaygroundShell() {
  const [inputJson, setInputJson] = useState(initialInputJson);
  const [outputJson, setOutputJson] = useState("");
  const [parseError, setParseError] = useState("");
  const [keyCount, setKeyCount] = useState(0);
  const [state, setState] = useState<FormatterState>("idle");

  function handleInputChange(value: string) {
    setInputJson(value);
    setOutputJson("");
    setParseError("");
    setKeyCount(0);
    setState("idle");
  }

  function handleFormat() {
    if (!inputJson.trim()) {
      setOutputJson("");
      setParseError("");
      setKeyCount(0);
      setState("idle");
      return;
    }

    try {
      const parsed = JSON.parse(inputJson) as unknown;
      setOutputJson(JSON.stringify(parsed, null, 2));
      setParseError("");
      setKeyCount(countJsonKeys(parsed));
      setState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Jason could not parse this JSON.";
      setOutputJson("");
      setParseError(message);
      setKeyCount(0);
      setState("error");
    }
  }

  function handleClear() {
    setInputJson("");
    setOutputJson("");
    setParseError("");
    setKeyCount(0);
    setState("idle");
  }

  function handleCopy() {
    const valueToCopy = outputJson || inputJson;

    if (!valueToCopy.trim()) {
      return;
    }

    void navigator.clipboard?.writeText(valueToCopy);
  }

  const outputCode =
    parseError || outputJson || "Formatted JSON will appear here.";
  const statusDetail =
    state === "error"
      ? parseError
      : state === "success"
        ? "Output is formatted and ready to copy."
        : inputJson.trim()
          ? "Jason is ready to format this JSON."
          : "Paste some JSON to wake Jason.";
  const footerHint =
    state === "error"
      ? "Error state: Jason stays calm, shows the parse issue, and gives one next action."
      : state === "success"
        ? "Ready state: Jason confirms valid JSON, then keeps actions close to the result."
        : "Idle state: paste JSON, then run Format to generate a clean output.";

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
          <JasonStatus detail={statusDetail} tone={state} />
        </section>

        <ToolTabs />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
          <CodePanel
            title="Input JSON"
            meta="editable"
            code={inputJson}
            editable
            onChange={handleInputChange}
          />
          <CodePanel
            title="Formatted Output"
            meta={state === "error" ? "parse error" : outputJson ? "formatted" : "waiting"}
            code={outputCode}
            tone={state === "error" ? "error" : outputJson ? "success" : "default"}
          />
          <InspectorPanel
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
            <Button onClick={handleFormat}>Format</Button>
            <Button variant="secondary" onClick={handleCopy}>
              Copy
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
