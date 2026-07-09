"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs, type PlaygroundTool } from "./ToolTabs";
import { diffJson, formatJson, patchJson, pointerJson } from "./api";
import {
  diffAfterJson,
  diffBeforeJson,
  initialInputJson,
  patchDocumentJson,
  patchOperationsJson,
  pointerDocumentJson,
  pointerPathInput,
} from "./constants";
import type {
  DiffJsonResponse,
  FormatterState,
  PatchJsonResponse,
  PlaygroundErrorField,
  PointerJsonResponse,
} from "./types";
import {
  buildDiffHighlights,
  buildPatchOperationHighlights,
  countJsonKeys,
  countLines,
  lineForJsonPointer,
  parseErrorLine,
  parsePatchOperations,
  pointerDepth,
  primaryPointerPath,
} from "./playground-utils";

function errorField(error: unknown) {
  return error instanceof Error && "field" in error
    ? (error.field as PlaygroundErrorField | undefined)
    : undefined;
}

export function PlaygroundShell() {
  const [activeTool, setActiveTool] = useState<PlaygroundTool>("Formatter");
  const [inputJson, setInputJson] = useState(initialInputJson);
  const [diffBeforeInput, setDiffBeforeInput] = useState(diffBeforeJson);
  const [diffAfterInput, setDiffAfterInput] = useState(diffAfterJson);
  const [patchDocumentInput, setPatchDocumentInput] = useState(patchDocumentJson);
  const [patchOperationsInput, setPatchOperationsInput] =
    useState(patchOperationsJson);
  const [patchOutput, setPatchOutput] = useState("");
  const [pointerDocumentInput, setPointerDocumentInput] =
    useState(pointerDocumentJson);
  const [pointerPath, setPointerPath] = useState(pointerPathInput);
  const [pointerOutput, setPointerOutput] = useState("");
  const [outputJson, setOutputJson] = useState("");
  const [parseError, setParseError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [keyCount, setKeyCount] = useState(0);
  const [state, setState] = useState<FormatterState>("idle");
  const [diffState, setDiffState] = useState<FormatterState>("idle");
  const [diffError, setDiffError] = useState("");
  const [diffErrorField, setDiffErrorField] = useState<
    "after" | "before" | undefined
  >();
  const [diffResult, setDiffResult] = useState<DiffJsonResponse | null>(null);
  const [patchState, setPatchState] = useState<FormatterState>("idle");
  const [patchError, setPatchError] = useState("");
  const [patchErrorField, setPatchErrorField] = useState<
    "document" | "patch" | undefined
  >();
  const [patchResult, setPatchResult] = useState<PatchJsonResponse | null>(null);
  const [pointerState, setPointerState] = useState<FormatterState>("idle");
  const [pointerError, setPointerError] = useState("");
  const [pointerErrorField, setPointerErrorField] = useState<
    "document" | "path" | undefined
  >();
  const [pointerResult, setPointerResult] =
    useState<PointerJsonResponse | null>(null);

  function handleInputChange(value: string) {
    setInputJson(value);
    setOutputJson("");
    setParseError("");
    setCopyMessage("");
    setKeyCount(0);
    setState("idle");
  }

  function handleDiffInputChange(side: "before" | "after", value: string) {
    if (side === "before") {
      setDiffBeforeInput(value);
    } else {
      setDiffAfterInput(value);
    }

    setDiffError("");
    setDiffErrorField(undefined);
    setDiffResult(null);
    setCopyMessage("");
    setDiffState("idle");
  }

  function handlePatchInputChange(side: "document" | "patch", value: string) {
    if (side === "document") {
      setPatchDocumentInput(value);
    } else {
      setPatchOperationsInput(value);
    }

    setPatchOutput("");
    setPatchError("");
    setPatchErrorField(undefined);
    setPatchResult(null);
    setCopyMessage("");
    setPatchState("idle");
  }

  function handlePointerInputChange(side: "document" | "path", value: string) {
    if (side === "document") {
      setPointerDocumentInput(value);
    } else {
      setPointerPath(value);
    }

    setPointerOutput("");
    setPointerError("");
    setPointerErrorField(undefined);
    setPointerResult(null);
    setCopyMessage("");
    setPointerState("idle");
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

      const { output: formattedOutput } = await formatJson(inputJson);

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

  async function handleDiff() {
    if (
      diffState === "thinking" ||
      !diffBeforeInput.trim() ||
      !diffAfterInput.trim()
    ) {
      setDiffError("");
      setDiffResult(null);
      setCopyMessage("");
      setDiffState("idle");
      return;
    }

    try {
      setDiffState("thinking");
      setDiffError("");
      setDiffErrorField(undefined);
      setDiffResult(null);
      setCopyMessage("");

      const diffResponse = await diffJson(diffBeforeInput, diffAfterInput);

      if (
        !Array.isArray(diffResponse.operations) ||
        typeof diffResponse.summary?.changes !== "number"
      ) {
        throw new Error("Diff returned an unexpected response.");
      }

      setDiffResult(diffResponse);
      setDiffErrorField(undefined);
      setDiffState("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Jason could not compare these documents.";
      const field = errorField(error);

      setDiffErrorField(
        field === "before" || field === "after" ? field : undefined,
      );
      setDiffError(message);
      setDiffResult(null);
      setDiffState("error");
    }
  }

  async function handlePatch() {
    if (
      patchState === "thinking" ||
      !patchDocumentInput.trim() ||
      !patchOperationsInput.trim()
    ) {
      setPatchOutput("");
      setPatchError("");
      setPatchResult(null);
      setCopyMessage("");
      setPatchState("idle");
      return;
    }

    try {
      setPatchState("thinking");
      setPatchOutput("");
      setPatchError("");
      setPatchErrorField(undefined);
      setPatchResult(null);
      setCopyMessage("");

      const patchResponse = await patchJson(
        patchDocumentInput,
        patchOperationsInput,
      );

      if (
        typeof patchResponse.output !== "string" ||
        typeof patchResponse.summary?.operations !== "number"
      ) {
        throw new Error("Patch returned an unexpected response.");
      }

      setPatchOutput(patchResponse.output);
      setPatchResult(patchResponse);
      setPatchErrorField(undefined);
      setPatchState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Jason could not apply this patch.";
      const field = errorField(error);

      setPatchErrorField(
        field === "document" || field === "patch" ? field : undefined,
      );
      setPatchOutput("");
      setPatchError(message);
      setPatchResult(null);
      setPatchState("error");
    }
  }

  async function handlePointer() {
    const path = primaryPointerPath(pointerPath);

    if (
      pointerState === "thinking" ||
      !pointerDocumentInput.trim() ||
      !path
    ) {
      setPointerOutput("");
      setPointerError("");
      setPointerResult(null);
      setCopyMessage("");
      setPointerState("idle");
      return;
    }

    try {
      setPointerState("thinking");
      setPointerOutput("");
      setPointerError("");
      setPointerErrorField(undefined);
      setPointerResult(null);
      setCopyMessage("");

      const pointerResponse = await pointerJson(pointerDocumentInput, path);

      if (
        typeof pointerResponse.output !== "string" ||
        typeof pointerResponse.summary?.kind !== "string"
      ) {
        throw new Error("Pointer returned an unexpected response.");
      }

      setPointerOutput(pointerResponse.output);
      setPointerResult(pointerResponse);
      setPointerErrorField(undefined);
      setPointerState("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Jason could not resolve this pointer.";
      const field = errorField(error);

      setPointerErrorField(
        field === "document" || field === "path" ? field : undefined,
      );
      setPointerOutput("");
      setPointerError(message);
      setPointerResult(null);
      setPointerState("error");
    }
  }

  function handleClear() {
    setCopyMessage("");

    if (activeTool === "Diff") {
      setDiffBeforeInput("");
      setDiffAfterInput("");
      setDiffError("");
      setDiffErrorField(undefined);
      setDiffResult(null);
      setDiffState("idle");
      return;
    }

    if (activeTool === "Patch") {
      setPatchDocumentInput("");
      setPatchOperationsInput("");
      setPatchOutput("");
      setPatchError("");
      setPatchErrorField(undefined);
      setPatchResult(null);
      setPatchState("idle");
      return;
    }

    if (activeTool === "Pointer") {
      setPointerDocumentInput("");
      setPointerPath("");
      setPointerOutput("");
      setPointerError("");
      setPointerErrorField(undefined);
      setPointerResult(null);
      setPointerState("idle");
      return;
    }

    setInputJson("");
    setOutputJson("");
    setParseError("");
    setKeyCount(0);
    setState("idle");
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

  const outputCode =
    (parseError ? `Jason couldn't parse this JSON.\n\n${parseError}` : outputJson) ||
    "Formatted JSON will appear here.";
  const isDiff = activeTool === "Diff";
  const isPatch = activeTool === "Patch";
  const isPointer = activeTool === "Pointer";
  const isFormatting = state === "thinking";
  const isDiffing = diffState === "thinking";
  const isPatching = patchState === "thinking";
  const isResolvingPointer = pointerState === "thinking";
  const selectedPointerPath = primaryPointerPath(pointerPath);
  const canRunPrimaryAction =
    (isDiff &&
      !isDiffing &&
      diffBeforeInput.trim().length > 0 &&
      diffAfterInput.trim().length > 0) ||
    (isPatch &&
      !isPatching &&
      patchDocumentInput.trim().length > 0 &&
      patchOperationsInput.trim().length > 0) ||
    (isPointer &&
      !isResolvingPointer &&
      pointerDocumentInput.trim().length > 0 &&
      selectedPointerPath.length > 0) ||
    (!isDiff &&
      !isPatch &&
      !isPointer &&
      inputJson.trim().length > 0 &&
      !isFormatting);
  const canCopy = isDiff
    ? Boolean(diffResult)
    : isPatch
      ? Boolean(patchOutput.trim())
      : isPointer
        ? Boolean(pointerOutput.trim())
      : Boolean(outputJson.trim());
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
  const errorLine = state === "error" ? parseErrorLine(parseError) : undefined;
  const diffErrorLine = diffState === "error" ? parseErrorLine(diffError) : undefined;
  const patchErrorLine =
    patchState === "error" ? parseErrorLine(patchError) : undefined;
  const pointerErrorLine =
    pointerState === "error" ? parseErrorLine(pointerError) : undefined;
  const beforeDiffErrorLine =
    diffErrorField === "before" ? diffErrorLine ?? 1 : undefined;
  const afterDiffErrorLine =
    diffErrorField === "after" ? diffErrorLine ?? 1 : undefined;
  const patchDocumentErrorLine =
    patchErrorField === "document" ? patchErrorLine ?? 1 : undefined;
  const patchOperationsErrorLine =
    patchErrorField === "patch" ? patchErrorLine ?? 1 : undefined;
  const pointerDocumentErrorLine =
    pointerErrorField === "document" ? pointerErrorLine ?? 1 : undefined;
  const pointerPathErrorLine =
    pointerErrorField === "path" && pointerPath.trim() ? 1 : undefined;
  const beforeDiffHighlights = useMemo(
    () => buildDiffHighlights(diffBeforeInput, diffResult?.operations, "before"),
    [diffBeforeInput, diffResult?.operations],
  );
  const afterDiffHighlights = useMemo(
    () => buildDiffHighlights(diffAfterInput, diffResult?.operations, "after"),
    [diffAfterInput, diffResult?.operations],
  );
  const patchOperations = useMemo(
    () => parsePatchOperations(patchOperationsInput),
    [patchOperationsInput],
  );
  const patchOperationHighlights = useMemo(
    () => buildPatchOperationHighlights(patchOperationsInput),
    [patchOperationsInput],
  );
  const patchResultHighlights = useMemo(
    () =>
      patchState === "success"
        ? buildDiffHighlights(patchOutput, patchOperations, "after")
        : [],
    [patchOperations, patchOutput, patchState],
  );
  const pointerSourceHighlights = useMemo(() => {
    if (pointerState !== "success" || !pointerResult?.summary.path) {
      return [];
    }

    const line = lineForJsonPointer(
      pointerDocumentInput,
      pointerResult.summary.path,
    );

    return line ? [{ line, tone: "add" as const }] : [];
  }, [pointerDocumentInput, pointerResult, pointerState]);
  const currentDiffSummary = diffResult?.summary ?? {
    added: 0,
    changes: 0,
    removed: 0,
    replaced: 0,
  };
  const currentPatchSummary = patchResult?.summary ?? {
    added: 0,
    operations: 0,
    removed: 0,
    replaced: 0,
  };
  const currentPointerSummary = pointerResult?.summary ?? {
    depth: selectedPointerPath ? pointerDepth(selectedPointerPath) : 0,
    found: false,
    issues: pointerState === "error" ? 1 : 0,
    kind: "unknown",
    path: selectedPointerPath || "none",
  };
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
    { label: "Changes", value: currentDiffSummary.changes },
    { label: "Added", tone: "success", value: `+${currentDiffSummary.added}` },
    { label: "Removed", tone: "danger", value: `-${currentDiffSummary.removed}` },
    { label: "Review", tone: "warning", value: currentDiffSummary.replaced },
    {
      label: "Issues",
      tone: diffState === "error" ? "danger" : "success",
      value: diffState === "error" ? 1 : 0,
    },
  ] satisfies Parameters<typeof InspectorPanel>[0]["stats"];
  const patchStats = [
    { label: "Ops", value: currentPatchSummary.operations },
    { label: "Added", tone: "success", value: `+${currentPatchSummary.added}` },
    { label: "Removed", tone: "danger", value: `-${currentPatchSummary.removed}` },
    { label: "Review", tone: "warning", value: currentPatchSummary.replaced },
    {
      label: "Issues",
      tone: patchState === "error" ? "danger" : "success",
      value: patchState === "error" ? 1 : 0,
    },
  ] satisfies Parameters<typeof InspectorPanel>[0]["stats"];
  const pointerStats = [
    { label: "Kind", value: currentPointerSummary.kind },
    { label: "Path", value: currentPointerSummary.path },
    { label: "Depth", value: currentPointerSummary.depth },
    {
      label: "Found",
      tone: currentPointerSummary.found ? "success" : "default",
      value: String(currentPointerSummary.found),
    },
    {
      label: "Issues",
      tone: pointerState === "error" ? "danger" : "success",
      value: pointerState === "error" ? 1 : currentPointerSummary.issues,
    },
  ] satisfies Parameters<typeof InspectorPanel>[0]["stats"];
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
            stats={
              isDiff
                ? diffStats
                : isPatch
                  ? patchStats
                  : isPointer
                    ? pointerStats
                    : formatterStats
            }
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
