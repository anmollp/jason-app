import { useMemo, useState } from "react";

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
import type {
  DiffJsonResponse,
  FormatterState,
  InspectorStat,
  PatchJsonResponse,
  PlaygroundErrorField,
  PointerJsonResponse,
} from "./types";

function errorField(error: unknown) {
  return error instanceof Error && "field" in error
    ? (error.field as PlaygroundErrorField | undefined)
    : undefined;
}

export function useFormatterTool(resetCopyMessage: () => void) {
  const [inputJson, setInputJson] = useState(initialInputJson);
  const [outputJson, setOutputJson] = useState("");
  const [parseError, setParseError] = useState("");
  const [keyCount, setKeyCount] = useState(0);
  const [state, setState] = useState<FormatterState>("idle");

  function handleInputChange(value: string) {
    setInputJson(value);
    setOutputJson("");
    setParseError("");
    resetCopyMessage();
    setKeyCount(0);
    setState("idle");
  }

  async function handleFormat() {
    if (!inputJson.trim() || state === "thinking") {
      setOutputJson("");
      setParseError("");
      resetCopyMessage();
      setKeyCount(0);
      setState("idle");
      return;
    }

    try {
      setState("thinking");
      setOutputJson("");
      setParseError("");
      resetCopyMessage();

      const { output: formattedOutput } = await formatJson(inputJson);

      if (typeof formattedOutput !== "string") {
        throw new Error("Formatter returned an unexpected response.");
      }

      const parsed = JSON.parse(formattedOutput) as unknown;

      setOutputJson(formattedOutput);
      setParseError("");
      resetCopyMessage();
      setKeyCount(countJsonKeys(parsed));
      setState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Jason could not parse this JSON.";

      setOutputJson("");
      setParseError(message);
      resetCopyMessage();
      setKeyCount(0);
      setState("error");
    }
  }

  function clear() {
    setInputJson("");
    setOutputJson("");
    setParseError("");
    setKeyCount(0);
    setState("idle");
  }

  const outputCode =
    (parseError ? `Jason couldn't parse this JSON.\n\n${parseError}` : outputJson) ||
    "Formatted JSON will appear here.";
  const errorLine = state === "error" ? parseErrorLine(parseError) : undefined;
  const stats = [
    { label: "Lines", value: countLines(outputJson || inputJson) },
    { label: "Keys", value: keyCount },
    {
      label: "Issues",
      tone: state === "error" ? "danger" : "success",
      value: state === "error" ? 1 : 0,
    },
  ] satisfies InspectorStat[];

  return {
    canCopy: Boolean(outputJson.trim()),
    canRun: inputJson.trim().length > 0 && state !== "thinking",
    clear,
    errorLine,
    handleFormat,
    handleInputChange,
    inputJson,
    isThinking: state === "thinking",
    keyCount,
    outputCode,
    outputJson,
    parseError,
    state,
    stats,
  };
}

export function useDiffTool(resetCopyMessage: () => void) {
  const [diffBeforeInput, setDiffBeforeInput] = useState(diffBeforeJson);
  const [diffAfterInput, setDiffAfterInput] = useState(diffAfterJson);
  const [diffState, setDiffState] = useState<FormatterState>("idle");
  const [diffError, setDiffError] = useState("");
  const [diffErrorField, setDiffErrorField] = useState<
    "after" | "before" | undefined
  >();
  const [diffResult, setDiffResult] = useState<DiffJsonResponse | null>(null);

  function handleDiffInputChange(side: "before" | "after", value: string) {
    if (side === "before") {
      setDiffBeforeInput(value);
    } else {
      setDiffAfterInput(value);
    }

    setDiffError("");
    setDiffErrorField(undefined);
    setDiffResult(null);
    resetCopyMessage();
    setDiffState("idle");
  }

  async function handleDiff() {
    if (
      diffState === "thinking" ||
      !diffBeforeInput.trim() ||
      !diffAfterInput.trim()
    ) {
      setDiffError("");
      setDiffResult(null);
      resetCopyMessage();
      setDiffState("idle");
      return;
    }

    try {
      setDiffState("thinking");
      setDiffError("");
      setDiffErrorField(undefined);
      setDiffResult(null);
      resetCopyMessage();

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

  function clear() {
    setDiffBeforeInput("");
    setDiffAfterInput("");
    setDiffError("");
    setDiffErrorField(undefined);
    setDiffResult(null);
    setDiffState("idle");
  }

  const diffErrorLine =
    diffState === "error" ? parseErrorLine(diffError) : undefined;
  const beforeDiffErrorLine =
    diffErrorField === "before" ? diffErrorLine ?? 1 : undefined;
  const afterDiffErrorLine =
    diffErrorField === "after" ? diffErrorLine ?? 1 : undefined;
  const beforeDiffHighlights = useMemo(
    () => buildDiffHighlights(diffBeforeInput, diffResult?.operations, "before"),
    [diffBeforeInput, diffResult?.operations],
  );
  const afterDiffHighlights = useMemo(
    () => buildDiffHighlights(diffAfterInput, diffResult?.operations, "after"),
    [diffAfterInput, diffResult?.operations],
  );
  const currentDiffSummary = diffResult?.summary ?? {
    added: 0,
    changes: 0,
    removed: 0,
    replaced: 0,
  };
  const stats = [
    { label: "Changes", value: currentDiffSummary.changes },
    { label: "Added", tone: "success", value: `+${currentDiffSummary.added}` },
    { label: "Removed", tone: "danger", value: `-${currentDiffSummary.removed}` },
    { label: "Review", tone: "warning", value: currentDiffSummary.replaced },
    {
      label: "Issues",
      tone: diffState === "error" ? "danger" : "success",
      value: diffState === "error" ? 1 : 0,
    },
  ] satisfies InspectorStat[];

  return {
    afterDiffErrorLine,
    afterDiffHighlights,
    beforeDiffErrorLine,
    beforeDiffHighlights,
    canCopy: Boolean(diffResult),
    canRun:
      diffState !== "thinking" &&
      diffBeforeInput.trim().length > 0 &&
      diffAfterInput.trim().length > 0,
    clear,
    currentDiffSummary,
    diffAfterInput,
    diffBeforeInput,
    diffError,
    diffResult,
    diffState,
    handleDiff,
    handleDiffInputChange,
    isThinking: diffState === "thinking",
    stats,
  };
}

export function usePatchTool(resetCopyMessage: () => void) {
  const [patchDocumentInput, setPatchDocumentInput] = useState(patchDocumentJson);
  const [patchOperationsInput, setPatchOperationsInput] =
    useState(patchOperationsJson);
  const [patchOutput, setPatchOutput] = useState("");
  const [patchState, setPatchState] = useState<FormatterState>("idle");
  const [patchError, setPatchError] = useState("");
  const [patchErrorField, setPatchErrorField] = useState<
    "document" | "patch" | undefined
  >();
  const [patchResult, setPatchResult] = useState<PatchJsonResponse | null>(null);

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
    resetCopyMessage();
    setPatchState("idle");
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
      resetCopyMessage();
      setPatchState("idle");
      return;
    }

    try {
      setPatchState("thinking");
      setPatchOutput("");
      setPatchError("");
      setPatchErrorField(undefined);
      setPatchResult(null);
      resetCopyMessage();

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

  function clear() {
    setPatchDocumentInput("");
    setPatchOperationsInput("");
    setPatchOutput("");
    setPatchError("");
    setPatchErrorField(undefined);
    setPatchResult(null);
    setPatchState("idle");
  }

  const patchErrorLine =
    patchState === "error" ? parseErrorLine(patchError) : undefined;
  const patchDocumentErrorLine =
    patchErrorField === "document" ? patchErrorLine ?? 1 : undefined;
  const patchOperationsErrorLine =
    patchErrorField === "patch" ? patchErrorLine ?? 1 : undefined;
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
  const currentPatchSummary = patchResult?.summary ?? {
    added: 0,
    operations: 0,
    removed: 0,
    replaced: 0,
  };
  const stats = [
    { label: "Ops", value: currentPatchSummary.operations },
    { label: "Added", tone: "success", value: `+${currentPatchSummary.added}` },
    { label: "Removed", tone: "danger", value: `-${currentPatchSummary.removed}` },
    { label: "Review", tone: "warning", value: currentPatchSummary.replaced },
    {
      label: "Issues",
      tone: patchState === "error" ? "danger" : "success",
      value: patchState === "error" ? 1 : 0,
    },
  ] satisfies InspectorStat[];

  return {
    canCopy: Boolean(patchOutput.trim()),
    canRun:
      patchState !== "thinking" &&
      patchDocumentInput.trim().length > 0 &&
      patchOperationsInput.trim().length > 0,
    clear,
    currentPatchSummary,
    handlePatch,
    handlePatchInputChange,
    isThinking: patchState === "thinking",
    patchDocumentErrorLine,
    patchDocumentInput,
    patchError,
    patchOperationHighlights,
    patchOperationsErrorLine,
    patchOperationsInput,
    patchOutput,
    patchResultHighlights,
    patchState,
    stats,
  };
}

export function usePointerTool(resetCopyMessage: () => void) {
  const [pointerDocumentInput, setPointerDocumentInput] =
    useState(pointerDocumentJson);
  const [pointerPath, setPointerPath] = useState(pointerPathInput);
  const [pointerOutput, setPointerOutput] = useState("");
  const [pointerState, setPointerState] = useState<FormatterState>("idle");
  const [pointerError, setPointerError] = useState("");
  const [pointerErrorField, setPointerErrorField] = useState<
    "document" | "path" | undefined
  >();
  const [pointerResult, setPointerResult] =
    useState<PointerJsonResponse | null>(null);

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
    resetCopyMessage();
    setPointerState("idle");
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
      resetCopyMessage();
      setPointerState("idle");
      return;
    }

    try {
      setPointerState("thinking");
      setPointerOutput("");
      setPointerError("");
      setPointerErrorField(undefined);
      setPointerResult(null);
      resetCopyMessage();

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

  function clear() {
    setPointerDocumentInput("");
    setPointerPath("");
    setPointerOutput("");
    setPointerError("");
    setPointerErrorField(undefined);
    setPointerResult(null);
    setPointerState("idle");
  }

  const selectedPointerPath = primaryPointerPath(pointerPath);
  const pointerErrorLine =
    pointerState === "error" ? parseErrorLine(pointerError) : undefined;
  const pointerDocumentErrorLine =
    pointerErrorField === "document" ? pointerErrorLine ?? 1 : undefined;
  const pointerPathErrorLine =
    pointerErrorField === "path" && pointerPath.trim() ? 1 : undefined;
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
  const currentPointerSummary = pointerResult?.summary ?? {
    depth: selectedPointerPath ? pointerDepth(selectedPointerPath) : 0,
    found: false,
    issues: pointerState === "error" ? 1 : 0,
    kind: "unknown",
    path: selectedPointerPath || "none",
  };
  const stats = [
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
  ] satisfies InspectorStat[];

  return {
    canCopy: Boolean(pointerOutput.trim()),
    canRun:
      pointerState !== "thinking" &&
      pointerDocumentInput.trim().length > 0 &&
      selectedPointerPath.length > 0,
    clear,
    currentPointerSummary,
    handlePointer,
    handlePointerInputChange,
    isThinking: pointerState === "thinking",
    pointerDocumentErrorLine,
    pointerDocumentInput,
    pointerError,
    pointerOutput,
    pointerPath,
    pointerPathErrorLine,
    pointerSourceHighlights,
    pointerState,
    selectedPointerPath,
    stats,
  };
}
