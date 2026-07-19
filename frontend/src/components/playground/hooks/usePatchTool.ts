import { useMemo, useState } from "react";

import { patchJson } from "../api";
import { patchDocumentJson, patchOperationSample } from "../constants";
import {
  formatByteSize,
  getJsonRequestByteLength,
  maxJsonPayloadBytes,
  maxJsonPayloadLabel,
} from "../payload-utils";
import {
  buildDiffHighlights,
  parseErrorLine,
} from "../playground-utils";
import {
  buildPatchOperation,
  validatePatchOperations,
} from "../patch-operations";
import type {
  FormatterState,
  InspectorStat,
  JsonPatchOperation,
  PatchJsonResponse,
} from "../types";

import { errorField } from "./utils";

export function usePatchTool(resetCopyMessage: () => void) {
  const [patchDocumentInput, setPatchDocumentInput] = useState(patchDocumentJson);
  const [patchOperations, setPatchOperations] = useState<JsonPatchOperation[]>(
    patchOperationSample,
  );
  const [patchOutput, setPatchOutput] = useState("");
  const [patchState, setPatchState] = useState<FormatterState>("idle");
  const [patchError, setPatchError] = useState("");
  const [patchErrorField, setPatchErrorField] = useState<
    "document" | "patch" | undefined
  >();
  const [patchResult, setPatchResult] = useState<PatchJsonResponse | null>(null);
  const [selectedPatchLine, setSelectedPatchLine] = useState<number | undefined>();
  const [selectedPatchPath, setSelectedPatchPath] = useState("");
  const patchInput = JSON.stringify(patchOperations);
  const payloadSizeBytes = getJsonRequestByteLength({
    document: patchDocumentInput,
    patch: patchInput,
  });
  const isOverPayloadLimit = payloadSizeBytes > maxJsonPayloadBytes;
  const payloadSizeLabel = formatByteSize(payloadSizeBytes);

  function handlePatchDocumentChange(value: string) {
    setPatchDocumentInput(value);
    setSelectedPatchLine(undefined);
    setSelectedPatchPath("");
    resetPatchResult();
  }

  function resetPatchResult() {
    setPatchOutput("");
    setPatchError("");
    setPatchErrorField(undefined);
    setPatchResult(null);
    resetCopyMessage();
    setPatchState("idle");
  }

  function handlePatchDocumentSelection(selection: { line: number; path: string }) {
    setSelectedPatchPath(selection.path);
    setSelectedPatchLine(selection.path ? selection.line : undefined);
  }

  function handlePatchOperationCreate(op: JsonPatchOperation["op"]) {
    const operation = buildPatchOperation(
      patchDocumentInput,
      selectedPatchPath,
      op,
      patchOperations,
    );

    if (!operation) {
      return undefined;
    }

    const nextOperations = [...patchOperations, operation];

    setPatchOperations(nextOperations);
    setSelectedPatchLine(undefined);
    setSelectedPatchPath("");
    resetPatchResult();

    return nextOperations.length - 1;
  }

  function handlePatchOperationRemove(index: number) {
    const nextOperations = patchOperations.filter((_, operationIndex) => {
      return operationIndex !== index;
    });

    setPatchOperations(nextOperations);
    resetPatchResult();
  }

  function handlePatchOperationUpdate(
    index: number,
    nextOperation: JsonPatchOperation,
  ) {
    if (!patchOperations[index]) {
      return;
    }

    const nextOperations = patchOperations.map((operation, operationIndex) => {
      return operationIndex === index ? nextOperation : operation;
    });

    setPatchOperations(nextOperations);
    resetPatchResult();
  }

  async function handlePatch() {
    if (
      patchState === "thinking" ||
      !patchDocumentInput.trim() ||
      patchOperations.length === 0 ||
      patchOperationIssues.length > 0
    ) {
      setPatchOutput("");
      setPatchError("");
      setPatchResult(null);
      resetCopyMessage();
      setPatchState("idle");
      return;
    }

    if (isOverPayloadLimit) {
      setPatchOutput("");
      setPatchError(
        `This patch payload is ${payloadSizeLabel}. Jason supports patch payloads up to ${maxJsonPayloadLabel}.`,
      );
      setPatchErrorField(undefined);
      setPatchResult(null);
      resetCopyMessage();
      setPatchState("error");
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
        patchInput,
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
    setPatchOperations([]);
    setSelectedPatchLine(undefined);
    setSelectedPatchPath("");
    resetPatchResult();
  }

  function loadSample() {
    setPatchDocumentInput(patchDocumentJson);
    setPatchOperations([...patchOperationSample]);
    setSelectedPatchLine(undefined);
    setSelectedPatchPath("");
    resetPatchResult();
  }

  const patchErrorLine =
    patchState === "error" ? parseErrorLine(patchError) : undefined;
  const patchDocumentErrorLine =
    patchErrorField === "document" ? patchErrorLine ?? 1 : undefined;
  const patchOperationIssues = validatePatchOperations(
    patchDocumentInput,
    patchOperations,
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
      label: "Size",
      tone: isOverPayloadLimit ? "danger" : "success",
      value: payloadSizeLabel,
    },
    {
      label: "Issues",
      tone:
        patchState === "error" || patchOperationIssues.length > 0
          ? "danger"
          : "success",
      value: patchState === "error" ? 1 : patchOperationIssues.length,
    },
  ] satisfies InspectorStat[];

  return {
    canCopy: Boolean(patchOutput.trim()),
    canRun:
      patchState !== "thinking" &&
      patchDocumentInput.trim().length > 0 &&
      patchOperations.length > 0 &&
      patchOperationIssues.length === 0 &&
      !isOverPayloadLimit,
    clear,
    currentPatchSummary,
    handlePatch,
    handlePatchDocumentSelection,
    handlePatchDocumentChange,
    handlePatchOperationCreate,
    handlePatchOperationRemove,
    handlePatchOperationUpdate,
    isThinking: patchState === "thinking",
    isOverPayloadLimit,
    loadSample,
    patchDocumentErrorLine,
    patchDocumentInput,
    patchError,
    patchOperationIssues,
    patchOperations,
    patchOutput,
    payloadLimitLabel: maxJsonPayloadLabel,
    payloadSizeLabel,
    patchResultHighlights,
    patchState,
    selectedPatchLine,
    selectedPatchPath,
    stats,
  };
}
