"use client";

import Link from "next/link";
import { useState } from "react";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs, type PlaygroundTool } from "./ToolTabs";
import {
  useDiffTool,
  useFormatterTool,
  usePatchTool,
  usePointerTool,
} from "./hooks";
import { DiffView, FormatterView, PatchView, PointerView } from "./views";

export function PlaygroundShell() {
  const [activeTool, setActiveTool] = useState<PlaygroundTool>("Formatter");
  const [copyMessage, setCopyMessage] = useState("");
  const resetCopyMessage = () => setCopyMessage("");
  const formatter = useFormatterTool(resetCopyMessage);
  const diff = useDiffTool(resetCopyMessage);
  const patch = usePatchTool(resetCopyMessage);
  const pointer = usePointerTool(resetCopyMessage);
  const {
    handleFormat,
    inputJson,
    isOverPayloadLimit,
    isThinking: isFormatting,
    outputJson,
    parseError,
    payloadLimitLabel,
    payloadSizeLabel,
    state,
  } = formatter;
  const {
    currentDiffSummary,
    diffAfterInput,
    diffBeforeInput,
    diffError,
    diffResult,
    diffState,
    handleDiff,
    isOverPayloadLimit: isOverDiffPayloadLimit,
    isThinking: isDiffing,
    payloadLimitError: diffPayloadLimitError,
    payloadLimitLabel: diffPayloadLimitLabel,
  } = diff;
  const {
    handlePatch,
    isOverPayloadLimit: isOverPatchPayloadLimit,
    isThinking: isPatching,
    patchDocumentInput,
    patchError,
    patchOperationIssues,
    patchOperations,
    patchOutput,
    payloadLimitLabel: patchPayloadLimitLabel,
    payloadSizeLabel: patchPayloadSizeLabel,
    patchState,
  } = patch;
  const {
    currentPointerSummary,
    handlePointer,
    isOverPayloadLimit: isOverPointerPayloadLimit,
    isThinking: isResolvingPointer,
    pointerDocumentInput,
    pointerError,
    pointerOutput,
    payloadLimitLabel: pointerPayloadLimitLabel,
    payloadSizeLabel: pointerPayloadSizeLabel,
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

  function handleLoadSample() {
    setCopyMessage("");

    if (activeTool === "Diff") {
      diff.loadSample();
      return;
    }

    if (activeTool === "Patch") {
      patch.loadSample();
      return;
    }

    if (activeTool === "Pointer") {
      pointer.loadSample();
      return;
    }

    formatter.loadSample();
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
      ? isOverDiffPayloadLimit
        ? diffPayloadLimitError
        : diffState === "thinking"
        ? "Calling POST /diff on the backend."
        : diffState === "error"
          ? diffError
          : diffState === "success"
            ? "Patch operations are ready to review and copy."
            : diffBeforeInput.trim() && diffAfterInput.trim()
              ? "Jason is ready to compare these documents."
              : "Paste JSON into both sides to compare."
      : isPatch
        ? isOverPatchPayloadLimit
          ? `This patch payload is ${patchPayloadSizeLabel}. Trim it below ${patchPayloadLimitLabel}, then apply again.`
          : patchState === "thinking"
          ? "Calling POST /patch on the backend."
          : patchState === "error"
            ? patchError
            : patchState === "success"
              ? "Patched JSON is ready to review and copy."
              : patchOperationIssues.length
                ? "Fix invalid patch operation paths before applying."
              : patchDocumentInput.trim() && patchOperations.length
                ? "Jason is ready to apply these operations."
                : "Paste a document and add JSON Patch operations."
      : isPointer
        ? isOverPointerPayloadLimit
          ? `This pointer payload is ${pointerPayloadSizeLabel}. Trim it below ${pointerPayloadLimitLabel}, then find again.`
          : pointerState === "thinking"
          ? "Calling POST /pointer on the backend."
          : pointerState === "error"
            ? pointerError
            : pointerState === "success"
              ? `Pointer resolved to a ${currentPointerSummary.kind} at ${currentPointerSummary.path}.`
              : pointerDocumentInput.trim() && selectedPointerPath
                ? "Jason is ready to resolve this pointer."
                : "Paste JSON and a JSON Pointer path."
        : isOverPayloadLimit
      ? `This JSON is ${payloadSizeLabel}. Trim it below ${payloadLimitLabel}, then format again.`
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
      ? isOverDiffPayloadLimit
        ? "Jason needs a smaller payload."
        : diffState === "thinking"
        ? "Jason is comparing..."
        : diffState === "error"
          ? "Jason couldn't compare these documents."
          : diffState === "success"
            ? `Jason found ${currentDiffSummary.changes} changes`
            : "Jason is ready to compare"
      : isPatch
        ? isOverPatchPayloadLimit
          ? "Jason needs a smaller payload."
          : patchState === "thinking"
          ? "Jason is applying the patch..."
          : patchState === "error"
            ? "Jason couldn't apply this patch."
            : patchState === "success"
            ? "Jason applied the patch."
            : patchOperationIssues.length
              ? "Jason needs valid patch paths."
              : "Jason is ready to patch"
      : isPointer
        ? isOverPointerPayloadLimit
          ? "Jason needs a smaller payload."
          : pointerState === "thinking"
          ? "Jason is finding the value..."
          : pointerState === "error"
            ? "Jason couldn't resolve this pointer."
            : pointerState === "success"
              ? "Jason found the value."
              : "Jason is ready to inspect"
        : isOverPayloadLimit
      ? "Jason needs a smaller payload."
      : state === "thinking"
      ? "Jason is formatting..."
      : state === "error"
        ? "Jason couldn't parse this JSON."
        : undefined);
  const footerHint =
    isDiff
      ? isOverDiffPayloadLimit
        ? `Diff supports ${diffPayloadLimitLabel}.`
        : diffState === "thinking"
        ? "Calling POST /diff on the backend."
        : diffState === "error"
          ? "Fix the diff input, then compare again."
          : diffState === "success"
            ? "Diff result is generated from Rust patch operations."
            : "Paste before and after JSON, then run Compare."
      : isPatch
        ? isOverPatchPayloadLimit
          ? `Patch input is capped at ${patchPayloadLimitLabel}.`
          : patchState === "thinking"
          ? "Calling POST /patch on the backend."
          : patchState === "error"
            ? "Fix the document or patch operations, then apply again."
            : patchState === "success"
            ? "Patch result is generated by the Rust JSON Patch engine."
            : patchOperationIssues.length
              ? "Fix the highlighted operation path before running Apply Patch."
              : "Paste a document, add operations, then run Apply Patch."
      : isPointer
        ? isOverPointerPayloadLimit
          ? `Pointer input is capped at ${pointerPayloadLimitLabel}.`
          : pointerState === "thinking"
          ? "Calling POST /pointer on the backend."
          : pointerState === "error"
            ? "Fix the JSON document or pointer path, then find again."
            : pointerState === "success"
              ? "Pointer result is generated by the Rust JSON Pointer engine."
              : "Paste JSON and a JSON Pointer path, then run Find Value."
        : isOverPayloadLimit
      ? `Formatter input is capped at ${payloadLimitLabel} for this first large JSON release.`
      : state === "thinking"
      ? "Calling POST /format on the backend."
      : state === "error"
      ? "Fix the parse issue, then press Cmd/Ctrl + Enter to format again."
      : state === "success"
        ? "Formatted output is ready. Copy it or keep editing the input."
        : "Paste JSON, then run Format or press Cmd/Ctrl + Enter.";
  const sampleLabel = isDiff
    ? "Load Diff sample"
    : isPatch
      ? "Load Patch sample"
      : isPointer
        ? "Load Pointer sample"
        : "Load Formatter sample";

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
                : isDiff
                  ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]"
                  : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]"
          }`}
        >
          {isDiff ? (
            <DiffView tool={diff} />
          ) : isPatch ? (
            <PatchView tool={patch} />
          ) : isPointer ? (
            <PointerView tool={pointer} />
          ) : (
            <FormatterView tool={formatter} />
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
            <Button variant="secondary" onClick={handleLoadSample}>
              {sampleLabel}
            </Button>
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
