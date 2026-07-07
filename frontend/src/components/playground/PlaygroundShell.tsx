"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs, type PlaygroundTool } from "./ToolTabs";

const initialInputJson = `{
  "service": "billing",
  "region": "us-east-1",
  "retry": true
}`;
const diffBeforeJson = `{
  "status": "draft",
  "plan": "starter",
  "user": {
    "role": "viewer"
  }
}`;
const diffAfterJson = `{
  "status": "ready",
  "plan": "pro",
  "user": {
    "role": "admin"
  },
  "timeoutMs": 3000
}`;
const patchDocumentJson = diffBeforeJson;
const pointerDocumentJson = `{
  "user": {
    "id": 102483,
    "username": "coder_dev_703",
    "role": "Administrator"
  },
  "permissions": [
    "read",
    "write",
    "execute"
  ],
  "metadata": {
    "lastLogin": "2026-07-05T14:56:00Z"
  }
}`;
const pointerPathInput = "/user/role";
const patchOperationsJson = `[
  {
    "op": "replace",
    "path": "/status",
    "value": "ready"
  },
  {
    "op": "replace",
    "path": "/plan",
    "value": "pro"
  },
  {
    "op": "add",
    "path": "/timeoutMs",
    "value": 3000
  }
]`;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const formatEndpoint = `${apiBaseUrl}/format`;
const diffEndpoint = `${apiBaseUrl}/diff`;
const patchEndpoint = `${apiBaseUrl}/patch`;
const pointerEndpoint = `${apiBaseUrl}/pointer`;

type FormatterState = "idle" | "thinking" | "success" | "error";
type LineHighlight = {
  line: number;
  tone: "add" | "remove" | "change";
};

type FormatJsonResponse = {
  output: string;
};

type FormatJsonErrorResponse = {
  detail?: string;
  message?: string;
};

type JsonPatchOperation = {
  from?: string;
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
};

type DiffJsonResponse = {
  operations: JsonPatchOperation[];
  summary: {
    added: number;
    changes: number;
    removed: number;
    replaced: number;
  };
};

type PatchJsonResponse = {
  output: string;
  summary: {
    added: number;
    operations: number;
    removed: number;
    replaced: number;
  };
};

type PointerJsonResponse = {
  output: string;
  summary: {
    depth: number;
    found: boolean;
    issues: number;
    kind: string;
    path: string;
  };
};

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

function parseErrorLine(message: string) {
  const match = message.match(/\bline\s+(\d+)\b/i);
  const line = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(line) && line > 0 ? line : undefined;
}

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function lineForJsonPointer(input: string, path: string) {
  if (!path) {
    return input.trim() ? 1 : undefined;
  }

  const segments = path.split("/").slice(1).map(decodePointerSegment);
  const target = segments.at(-1);

  if (!target) {
    return undefined;
  }

  const lines = input.split(/\r?\n/);
  const quotedTarget = `"${target.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const targetIndex = lines.findIndex((line) => line.includes(quotedTarget));

  if (targetIndex >= 0) {
    return targetIndex + 1;
  }

  const arrayIndex = Number(target);

  if (Number.isInteger(arrayIndex) && arrayIndex >= 0) {
    return Math.min(arrayIndex + 2, lines.length);
  }

  return undefined;
}

function buildDiffHighlights(
  input: string,
  operations: JsonPatchOperation[] | undefined,
  side: "before" | "after",
): LineHighlight[] {
  if (!operations) {
    return [];
  }

  const highlights = operations.flatMap<LineHighlight>((operation) => {
    const line = lineForJsonPointer(input, operation.path);

    if (!line) {
      return [];
    }

    if (operation.op === "replace") {
      return [{ line, tone: "change" as const }];
    }

    if (side === "before" && operation.op === "remove") {
      return [{ line, tone: "remove" as const }];
    }

    if (side === "after" && operation.op === "add") {
      return [{ line, tone: "add" as const }];
    }

    return [];
  });

  return Array.from(
    new Map(highlights.map((highlight) => [highlight.line, highlight])).values(),
  );
}

function parsePatchOperations(input: string): JsonPatchOperation[] {
  try {
    const parsed = JSON.parse(input) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is JsonPatchOperation => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const operation = item as Record<string, unknown>;

      return typeof operation.op === "string" && typeof operation.path === "string";
    });
  } catch {
    return [];
  }
}

function buildPatchOperationHighlights(input: string): LineHighlight[] {
  return input.split(/\r?\n/).flatMap<LineHighlight>((line, index) => {
    const match = line.match(/"op"\s*:\s*"(add|remove|replace)"/);

    if (!match) {
      return [];
    }

    const [, op] = match;

    return [
      {
        line: index + 1,
        tone:
          op === "add"
            ? "add"
            : op === "remove"
              ? "remove"
              : "change",
      },
    ];
  });
}

function primaryPointerPath(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function pointerDepth(path: string) {
  return path ? path.split("/").slice(1).length : 0;
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
  const [diffResult, setDiffResult] = useState<DiffJsonResponse | null>(null);
  const [patchState, setPatchState] = useState<FormatterState>("idle");
  const [patchError, setPatchError] = useState("");
  const [patchResult, setPatchResult] = useState<PatchJsonResponse | null>(null);
  const [pointerState, setPointerState] = useState<FormatterState>("idle");
  const [pointerError, setPointerError] = useState("");
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

      const response = await fetch(formatEndpoint, {
        body: JSON.stringify({ input: inputJson }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as
        | FormatJsonResponse
        | FormatJsonErrorResponse;

      if (!response.ok) {
        const errorResponse = data as FormatJsonErrorResponse;

        throw new Error(
          errorResponse.detail ??
            errorResponse.message ??
            "Jason could not parse this JSON.",
        );
      }

      const formattedOutput = (data as FormatJsonResponse).output;

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
      setDiffResult(null);
      setCopyMessage("");

      const response = await fetch(diffEndpoint, {
        body: JSON.stringify({
          after: diffAfterInput,
          before: diffBeforeInput,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as DiffJsonResponse | FormatJsonErrorResponse;

      if (!response.ok) {
        const errorResponse = data as FormatJsonErrorResponse;

        throw new Error(
          errorResponse.detail ??
            errorResponse.message ??
            "Jason could not compare these documents.",
        );
      }

      const diffResponse = data as DiffJsonResponse;

      if (
        !Array.isArray(diffResponse.operations) ||
        typeof diffResponse.summary?.changes !== "number"
      ) {
        throw new Error("Diff returned an unexpected response.");
      }

      setDiffResult(diffResponse);
      setDiffState("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Jason could not compare these documents.";

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
      setPatchResult(null);
      setCopyMessage("");

      const response = await fetch(patchEndpoint, {
        body: JSON.stringify({
          document: patchDocumentInput,
          patch: patchOperationsInput,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as
        | PatchJsonResponse
        | FormatJsonErrorResponse;

      if (!response.ok) {
        const errorResponse = data as FormatJsonErrorResponse;

        throw new Error(
          errorResponse.detail ??
            errorResponse.message ??
            "Jason could not apply this patch.",
        );
      }

      const patchResponse = data as PatchJsonResponse;

      if (
        typeof patchResponse.output !== "string" ||
        typeof patchResponse.summary?.operations !== "number"
      ) {
        throw new Error("Patch returned an unexpected response.");
      }

      setPatchOutput(patchResponse.output);
      setPatchResult(patchResponse);
      setPatchState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Jason could not apply this patch.";

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
      setPointerResult(null);
      setCopyMessage("");

      const response = await fetch(pointerEndpoint, {
        body: JSON.stringify({
          document: pointerDocumentInput,
          path,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as
        | PointerJsonResponse
        | FormatJsonErrorResponse;

      if (!response.ok) {
        const errorResponse = data as FormatJsonErrorResponse;

        throw new Error(
          errorResponse.detail ??
            errorResponse.message ??
            "Jason could not resolve this pointer.",
        );
      }

      const pointerResponse = data as PointerJsonResponse;

      if (
        typeof pointerResponse.output !== "string" ||
        typeof pointerResponse.summary?.kind !== "string"
      ) {
        throw new Error("Pointer returned an unexpected response.");
      }

      setPointerOutput(pointerResponse.output);
      setPointerResult(pointerResponse);
      setPointerState("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Jason could not resolve this pointer.";

      setPointerOutput("");
      setPointerError(message);
      setPointerResult(null);
      setPointerState("error");
    }
  }

  function handleClear() {
    setInputJson("");
    setOutputJson("");
    setParseError("");
    setCopyMessage("");
    setKeyCount(0);
    setState("idle");
    setDiffBeforeInput("");
    setDiffAfterInput("");
    setDiffError("");
    setDiffResult(null);
    setDiffState("idle");
    setPatchDocumentInput("");
    setPatchOperationsInput("");
    setPatchOutput("");
    setPatchError("");
    setPatchResult(null);
    setPatchState("idle");
    setPointerDocumentInput("");
    setPointerPath("");
    setPointerOutput("");
    setPointerError("");
    setPointerResult(null);
    setPointerState("idle");
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
                meta="before"
                code={diffBeforeInput}
                editable
                highlightedLines={beforeDiffHighlights}
                onChange={(value) => handleDiffInputChange("before", value)}
                onSubmit={() => {
                  void handleDiff();
                }}
                showLineNumbers
              />
              <CodePanel
                title="Changed JSON"
                meta="after"
                code={diffAfterInput}
                editable
                highlightedLines={afterDiffHighlights}
                onChange={(value) => handleDiffInputChange("after", value)}
                onSubmit={() => {
                  void handleDiff();
                }}
                showLineNumbers
              />
            </>
          ) : isPatch ? (
            <>
              <CodePanel
                title="Document JSON"
                meta="input"
                code={patchDocumentInput}
                editable
                onChange={(value) => handlePatchInputChange("document", value)}
                onSubmit={() => {
                  void handlePatch();
                }}
                showLineNumbers
              />
              <CodePanel
                title="JSON Patch"
                meta="editable"
                code={patchOperationsInput}
                editable
                highlightedLines={patchOperationHighlights}
                onChange={(value) => handlePatchInputChange("patch", value)}
                onSubmit={() => {
                  void handlePatch();
                }}
                showLineNumbers
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
                meta="editable"
                code={pointerDocumentInput}
                editable
                highlightedLines={pointerSourceHighlights}
                onChange={(value) => handlePointerInputChange("document", value)}
                onSubmit={() => {
                  void handlePointer();
                }}
                showLineNumbers
              />
              <CodePanel
                title="Pointer Path"
                meta="path"
                code={pointerPath}
                editable
                onChange={(value) => handlePointerInputChange("path", value)}
                onSubmit={() => {
                  void handlePointer();
                }}
                shouldWrapLines={false}
                showLineNumbers
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
