import { useState } from "react";

import { formatJson } from "../api";
import { initialInputJson } from "../constants";
import {
  formatByteSize,
  getUtf8ByteLength,
  maxJsonPayloadBytes,
  maxJsonPayloadLabel,
} from "../payload-utils";
import { countJsonKeys, countLines, parseErrorLine } from "../playground-utils";
import type { FormatterState, InspectorStat } from "../types";

export function useFormatterTool(resetCopyMessage: () => void) {
  const [inputJson, setInputJson] = useState(initialInputJson);
  const [outputJson, setOutputJson] = useState("");
  const [parseError, setParseError] = useState("");
  const [keyCount, setKeyCount] = useState(0);
  const [state, setState] = useState<FormatterState>("idle");
  const inputSizeBytes = getUtf8ByteLength(inputJson);
  const isOverPayloadLimit = inputSizeBytes > maxJsonPayloadBytes;
  const payloadSizeLabel = formatByteSize(inputSizeBytes);

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

    if (isOverPayloadLimit) {
      setOutputJson("");
      setParseError(
        `This JSON is ${payloadSizeLabel}. Jason supports formatter payloads up to ${maxJsonPayloadLabel}.`,
      );
      resetCopyMessage();
      setKeyCount(0);
      setState("error");
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

  function loadSample() {
    setInputJson(initialInputJson);
    setOutputJson("");
    setParseError("");
    resetCopyMessage();
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
      label: "Size",
      tone: isOverPayloadLimit ? "danger" : inputSizeBytes > 0 ? "success" : "default",
      value: payloadSizeLabel,
    },
    {
      label: "Issues",
      tone: state === "error" ? "danger" : "success",
      value: state === "error" ? 1 : 0,
    },
  ] satisfies InspectorStat[];

  return {
    canCopy: Boolean(outputJson.trim()),
    canRun:
      inputJson.trim().length > 0 && state !== "thinking" && !isOverPayloadLimit,
    clear,
    errorLine,
    handleFormat,
    handleInputChange,
    inputJson,
    isOverPayloadLimit,
    isThinking: state === "thinking",
    keyCount,
    loadSample,
    outputCode,
    outputJson,
    parseError,
    payloadLimitLabel: maxJsonPayloadLabel,
    payloadSizeLabel,
    state,
    stats,
  };
}
