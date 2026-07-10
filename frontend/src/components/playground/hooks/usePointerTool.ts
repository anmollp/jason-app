import { useMemo, useState } from "react";

import { pointerJson } from "../api";
import { pointerDocumentJson, pointerPathInput } from "../constants";
import {
  lineForJsonPointer,
  parseErrorLine,
  pointerDepth,
  primaryPointerPath,
} from "../playground-utils";
import type { FormatterState, InspectorStat, PointerJsonResponse } from "../types";

import { errorField } from "./utils";

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

  function loadSample() {
    setPointerDocumentInput(pointerDocumentJson);
    setPointerPath(pointerPathInput);
    setPointerOutput("");
    setPointerError("");
    setPointerErrorField(undefined);
    setPointerResult(null);
    resetCopyMessage();
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
    loadSample,
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
