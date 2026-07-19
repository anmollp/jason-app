import { useMemo, useState } from "react";

import { diffJson } from "../api";
import { diffAfterJson, diffBeforeJson } from "../constants";
import {
  formatByteSize,
  getJsonRequestByteLength,
  getUtf8ByteLength,
  maxJsonPayloadBytes,
  maxJsonPayloadLabel,
} from "../payload-utils";
import {
  buildDiffHighlights,
  parseErrorLine,
} from "../playground-utils";
import type { DiffJsonResponse, FormatterState, InspectorStat } from "../types";

import { errorField } from "./utils";

export function useDiffTool(resetCopyMessage: () => void) {
  const [diffBeforeInput, setDiffBeforeInput] = useState(diffBeforeJson);
  const [diffAfterInput, setDiffAfterInput] = useState(diffAfterJson);
  const [diffState, setDiffState] = useState<FormatterState>("idle");
  const [diffError, setDiffError] = useState("");
  const [diffErrorField, setDiffErrorField] = useState<
    "after" | "before" | undefined
  >();
  const [diffResult, setDiffResult] = useState<DiffJsonResponse | null>(null);
  const beforeSizeBytes = getUtf8ByteLength(diffBeforeInput);
  const afterSizeBytes = getUtf8ByteLength(diffAfterInput);
  const payloadSizeBytes = getJsonRequestByteLength({
    after: diffAfterInput,
    before: diffBeforeInput,
  });
  const overLimitSide =
    beforeSizeBytes > maxJsonPayloadBytes
      ? "Before JSON"
      : afterSizeBytes > maxJsonPayloadBytes
        ? "Changed JSON"
        : undefined;
  const isOverPayloadLimit = Boolean(overLimitSide);
  const payloadSizeLabel = formatByteSize(payloadSizeBytes);
  const payloadLimitError = overLimitSide
    ? `${overLimitSide} is ${formatByteSize(
        overLimitSide === "Before JSON" ? beforeSizeBytes : afterSizeBytes,
      )}. Jason supports up to ${maxJsonPayloadLabel} per diff document.`
    : "";

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

    if (isOverPayloadLimit) {
      setDiffError(payloadLimitError);
      setDiffResult(null);
      resetCopyMessage();
      setDiffState("error");
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

  function loadSample() {
    setDiffBeforeInput(diffBeforeJson);
    setDiffAfterInput(diffAfterJson);
    setDiffError("");
    setDiffErrorField(undefined);
    setDiffResult(null);
    resetCopyMessage();
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
      label: "Size",
      tone: isOverPayloadLimit ? "danger" : "success",
      value: payloadSizeLabel,
    },
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
      diffAfterInput.trim().length > 0 &&
      !isOverPayloadLimit,
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
    isOverPayloadLimit,
    loadSample,
    payloadLimitError,
    payloadLimitLabel: `${maxJsonPayloadLabel} per document`,
    payloadSizeLabel,
    stats,
  };
}
