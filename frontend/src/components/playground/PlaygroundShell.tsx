"use client";

import Link from "next/link";
import { useState } from "react";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs, type PlaygroundTool } from "./ToolTabs";
import {
  useDiffTool,
  useFormatterTool,
  usePatchTool,
  usePointerTool,
} from "./hooks";

export function PlaygroundShell() {
  const [activeTool, setActiveTool] = useState<PlaygroundTool>("Formatter");
  const [copyMessage, setCopyMessage] = useState("");
  const resetCopyMessage = () => setCopyMessage("");
  const formatter = useFormatterTool(resetCopyMessage);
  const diff = useDiffTool(resetCopyMessage);
  const patch = usePatchTool(resetCopyMessage);
  const pointer = usePointerTool(resetCopyMessage);
  const {
    errorLine,
    handleFormat,
    handleInputChange,
    inputJson,
    isThinking: isFormatting,
    outputCode,
    outputJson,
    parseError,
    state,
  } = formatter;
  const {
    afterDiffErrorLine,
    afterDiffHighlights,
    beforeDiffErrorLine,
    beforeDiffHighlights,
    currentDiffSummary,
    diffAfterInput,
    diffBeforeInput,
    diffError,
    diffResult,
    diffState,
    handleDiff,
    handleDiffInputChange,
    isThinking: isDiffing,
  } = diff;
  const {
    handlePatch,
    handlePatchInputChange,
    isThinking: isPatching,
    patchDocumentErrorLine,
    patchDocumentInput,
    patchError,
    patchOperationHighlights,
    patchOperationsErrorLine,
    patchOperationsInput,
    patchOutput,
    patchResultHighlights,
    patchState,
  } = patch;
  const {
    currentPointerSummary,
    handlePointer,
    handlePointerInputChange,
    isThinking: isResolvingPointer,
    pointerDocumentErrorLine,
    pointerDocumentInput,
    pointerError,
    pointerOutput,
    pointerPath,
    pointerPathErrorLine,
    pointerSourceHighlights,
    pointerState,
    selectedPointerPath,
  } = pointer;

  function handleToolChange(tool: PlaygroundTool) {
    setActiveTool(tool);
    setCopyMessage("");
  }

  function handleClear() {
    setCopyMessage("");

    if (activeTool === "Diff") {
      diff.clear();
      return;
    }

    if (activeTool === "Patch") {
      patch.clear();
      return;
    }

    if (activeTool === "Pointer") {
      pointer.clear();
      return;
    }

    formatter.clear();
  }

  function handleCopy() {
    if (activeTool === "Diff") {
      if (!diffResult) {
        return;
      }

      void navigator.clipboard?.writeText(
        JSON.stringify(diffResult.operations, null, 2),
      );
      setCopyMessage("Copied patch operations.");
      return;
    }

    if (activeTool === "Patch") {
      if (!patchOutput.trim()) {
        return;
      }

      void navigator.clipboard?.writeText(patchOutput);
      setCopyMessage("Copied patched JSON.");
      return;
    }

    if (activeTool === "Pointer") {
      if (!pointerOutput.trim()) {
        return;
      }

      void navigator.clipboard?.writeText(pointerOutput);
      setCopyMessage("Copied resolved value.");
      return;
    }

    if (!outputJson.trim()) {
      return;
    }

    void navigator.clipboard?.writeText(outputJson);
    setCopyMessage("Copied formatted JSON.");
  }

  const isDiff = activeTool === "Diff";
  const isPatch = activeTool === "Patch";
  const isPointer = activeTool === "Pointer";
  const canRunPrimaryAction =
    (isDiff && diff.canRun) ||
    (isPatch && patch.canRun) ||
    (isPointer && pointer.canRun) ||
    (!isDiff && !isPatch && !isPointer && formatter.canRun);
  const canCopy = isDiff
    ? diff.canCopy
    : isPatch
      ? patch.canCopy
      : isPointer
        ? pointer.canCopy
        : formatter.canCopy;
  const copyLabel = isDiff
    ? "Patch"
    : isPatch
      ? patchState === "error"
        ? "Fix first"
        : "Copy"
      : isPointer
        ? pointerState === "error"
          ? "Fix first"
          : "Copy"
      : state === "error"
        ? "Fix first"
        : "Copy";
  const inspectorStats = isDiff
    ? diff.stats
    : isPatch
      ? patch.stats
      : isPointer
        ? pointer.stats
        : formatter.stats;
  const statusDetail =
    copyMessage ||
    (isDiff
      ? diffState === "thinking"
        ? "Calling POST /diff on the backend."
        : diffState === "error"
          ? diffError
          : diffState === "success"
            ? "Patch operations are ready to review and copy."
            : diffBeforeInput.trim() && diffAfterInput.trim()
              ? "Jason is ready to compare these documents."
              : "Paste JSON into both sides to compare."
      : isPatch
        ? patchState === "thinking"
          ? "Calling POST /patch on the backend."
          : patchState === "error"
            ? patchError
            : patchState === "success"
              ? "Patched JSON is ready to review and copy."
              : patchDocumentInput.trim() && patchOperationsInput.trim()
                ? "Jason is ready to apply these operations."
                : "Paste a document and JSON Patch operations."
      : isPointer
        ? pointerState === "thinking"
          ? "Calling POST /pointer on the backend."
          : pointerState === "error"
            ? pointerError
            : pointerState === "success"
              ? `Pointer resolved to a ${currentPointerSummary.kind} at ${currentPointerSummary.path}.`
              : pointerDocumentInput.trim() && selectedPointerPath
                ? "Jason is ready to resolve this pointer."
                : "Paste JSON and a JSON Pointer path."
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
      ? diffState === "thinking"
        ? "Jason is comparing..."
        : diffState === "error"
          ? "Jason couldn't compare these documents."
          : diffState === "success"
            ? `Jason found ${currentDiffSummary.changes} changes`
            : "Jason is ready to compare"
      : isPatch
        ? patchState === "thinking"
          ? "Jason is applying the patch..."
          : patchState === "error"
            ? "Jason couldn't apply this patch."
            : patchState === "success"
            ? "Jason applied the patch."
            : "Jason is ready to patch"
      : isPointer
        ? pointerState === "thinking"
          ? "Jason is finding the value..."
          : pointerState === "error"
            ? "Jason couldn't resolve this pointer."
            : pointerState === "success"
              ? "Jason found the value."
              : "Jason is ready to inspect"
        : state === "thinking"
      ? "Jason is formatting..."
      : state === "error"
        ? "Jason couldn't parse this JSON."
        : undefined);
  const footerHint =
    isDiff
      ? diffState === "thinking"
        ? "Calling POST /diff on the backend."
        : diffState === "error"
          ? "Fix the diff input, then compare again."
          : diffState === "success"
            ? "Diff result is generated from Rust patch operations."
            : "Paste before and after JSON, then run Compare."
      : isPatch
        ? patchState === "thinking"
          ? "Calling POST /patch on the backend."
          : patchState === "error"
            ? "Fix the document or patch operations, then apply again."
            : patchState === "success"
            ? "Patch result is generated by the Rust JSON Patch engine."
            : "Paste a document and JSON Patch operations, then run Apply Patch."
      : isPointer
        ? pointerState === "thinking"
          ? "Calling POST /pointer on the backend."
          : pointerState === "error"
            ? "Fix the JSON document or pointer path, then find again."
            : pointerState === "success"
              ? "Pointer result is generated by the Rust JSON Pointer engine."
              : "Paste JSON and a JSON Pointer path, then run Find Value."
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
                : isPatch
                  ? "Apply JSON patches safely."
                  : isPointer
                    ? "Find exact JSON paths instantly."
                  : "Format, diff, patch, and inspect JSON."}
            </h1>
          </div>
          <JasonStatus
            detail={statusDetail}
            title={statusTitle}
            tone={
              isDiff
                ? diffState
                : isPatch
                  ? patchState
                  : isPointer
                    ? pointerState
                    : state
            }
          />
        </section>

        <ToolTabs activeTool={activeTool} onToolChange={handleToolChange} />

        <section
          className={`grid gap-5 ${
            isPatch
              ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_170px]"
              : isPointer
                ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_170px]"
              : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]"
          }`}
        >
          {isDiff ? (
            <>
              <CodePanel
                title="Original JSON"
                meta={beforeDiffErrorLine ? `line ${beforeDiffErrorLine}` : "before"}
                code={diffBeforeInput}
                editable
                errorLine={beforeDiffErrorLine}
                highlightedLines={beforeDiffHighlights}
                onChange={(value) => handleDiffInputChange("before", value)}
                onSubmit={() => {
                  void handleDiff();
                }}
                showLineNumbers
                tone={beforeDiffErrorLine ? "error" : "default"}
              />
              <CodePanel
                title="Changed JSON"
                meta={afterDiffErrorLine ? `line ${afterDiffErrorLine}` : "after"}
                code={diffAfterInput}
                editable
                errorLine={afterDiffErrorLine}
                highlightedLines={afterDiffHighlights}
                onChange={(value) => handleDiffInputChange("after", value)}
                onSubmit={() => {
                  void handleDiff();
                }}
                showLineNumbers
                tone={afterDiffErrorLine ? "error" : "default"}
              />
            </>
          ) : isPatch ? (
            <>
              <CodePanel
                title="Document JSON"
                meta={
                  patchDocumentErrorLine
                    ? `line ${patchDocumentErrorLine}`
                    : "input"
                }
                code={patchDocumentInput}
                editable
                errorLine={patchDocumentErrorLine}
                onChange={(value) => handlePatchInputChange("document", value)}
                onSubmit={() => {
                  void handlePatch();
                }}
                showLineNumbers
                tone={patchDocumentErrorLine ? "error" : "default"}
              />
              <CodePanel
                title="JSON Patch"
                meta={
                  patchOperationsErrorLine
                    ? `line ${patchOperationsErrorLine}`
                    : "editable"
                }
                code={patchOperationsInput}
                editable
                errorLine={patchOperationsErrorLine}
                highlightedLines={patchOperationHighlights}
                onChange={(value) => handlePatchInputChange("patch", value)}
                onSubmit={() => {
                  void handlePatch();
                }}
                showLineNumbers
                tone={patchOperationsErrorLine ? "error" : "default"}
              />
              <CodePanel
                title="Patched Result"
                meta={
                  patchState === "thinking"
                    ? "applying"
                    : patchState === "error"
                      ? "patch error"
                      : patchOutput
                        ? "preview"
                        : "waiting"
                }
                code={
                  patchState === "error"
                    ? `Jason couldn't apply this patch.\n\n${patchError}`
                    : patchOutput || "Patched JSON will appear here."
                }
                highlightedLines={patchResultHighlights}
                tone={
                  patchState === "error"
                    ? "error"
                    : patchOutput
                      ? "success"
                      : "default"
                }
              />
            </>
          ) : isPointer ? (
            <>
              <CodePanel
                title="Source JSON"
                meta={
                  pointerDocumentErrorLine
                    ? `line ${pointerDocumentErrorLine}`
                    : "editable"
                }
                code={pointerDocumentInput}
                editable
                errorLine={pointerDocumentErrorLine}
                highlightedLines={pointerSourceHighlights}
                onChange={(value) => handlePointerInputChange("document", value)}
                onSubmit={() => {
                  void handlePointer();
                }}
                showLineNumbers
                tone={pointerDocumentErrorLine ? "error" : "default"}
              />
              <CodePanel
                title="Pointer Path"
                meta={pointerPathErrorLine ? "check path" : "path"}
                code={pointerPath}
                editable
                errorLine={pointerPathErrorLine}
                onChange={(value) => handlePointerInputChange("path", value)}
                onSubmit={() => {
                  void handlePointer();
                }}
                shouldWrapLines={false}
                showLineNumbers
                tone={pointerPathErrorLine ? "error" : "default"}
              />
              <CodePanel
                title="Result"
                meta={
                  pointerState === "thinking"
                    ? "finding"
                    : pointerState === "error"
                      ? "not found"
                      : pointerOutput
                        ? "result"
                        : "waiting"
                }
                code={
                  pointerState === "error"
                    ? `Jason couldn't resolve this pointer.\n\n${pointerError}`
                    : pointerOutput || "Resolved value will appear here."
                }
                highlightedLines={
                  pointerState === "success"
                    ? [{ line: 1, tone: "add" as const }]
                    : []
                }
                tone={
                  pointerState === "error"
                    ? "error"
                    : pointerOutput
                      ? "success"
                      : "default"
                }
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
                code={outputCode}
                tone={state === "error" ? "error" : outputJson ? "success" : "default"}
              />
            </>
          )}
          <InspectorPanel
            canCopy={canCopy}
            copyLabel={copyLabel}
            stats={inspectorStats}
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
                  void handleDiff();
                  return;
                }

                if (isPatch) {
                  void handlePatch();
                  return;
                }

                if (isPointer) {
                  void handlePointer();
                  return;
                }

                void handleFormat();
              }}
            >
              {isDiff
                ? isDiffing
                  ? "Comparing..."
                  : "Compare"
                : isPatch
                  ? isPatching
                    ? "Applying..."
                    : "Apply Patch"
                  : isPointer
                    ? isResolvingPointer
                      ? "Finding..."
                      : "Find Value"
                  : isFormatting
                    ? "Formatting..."
                    : "Format"}
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
