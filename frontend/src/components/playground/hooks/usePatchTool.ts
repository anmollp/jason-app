import { useMemo, useState } from "react";

import { patchJson } from "../api";
import { patchDocumentJson, patchOperationsJson } from "../constants";
import {
  buildDiffHighlights,
  buildPatchOperationHighlights,
  parseErrorLine,
  parsePatchOperations,
} from "../playground-utils";
import type { FormatterState, InspectorStat, PatchJsonResponse } from "../types";

import { errorField } from "./utils";

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
