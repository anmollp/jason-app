"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CodePanel, playgroundPanelHeightClass } from "../CodePanel";
import type { usePatchTool } from "../hooks";
import type { JsonPatchOperation } from "../types";

type PatchViewProps = {
  tool: ReturnType<typeof usePatchTool>;
};

const operationStyles = {
  add: {
    rail: "border-l-emerald-400",
    text: "text-emerald-300",
  },
  copy: {
    rail: "border-l-violet-400",
    text: "text-violet-300",
  },
  move: {
    rail: "border-l-blue-400",
    text: "text-blue-300",
  },
  remove: {
    rail: "border-l-red-400",
    text: "text-red-300",
  },
  replace: {
    rail: "border-l-amber-400",
    text: "text-amber-300",
  },
  test: {
    rail: "border-l-cyan-400",
    text: "text-cyan-300",
  },
} satisfies Record<
  JsonPatchOperation["op"],
  {
    rail: string;
    text: string;
  }
>;

const patchOperations = [
  { label: "Add", op: "add" },
  { label: "Replace", op: "replace" },
  { label: "Remove", op: "remove" },
  { label: "Move", op: "move" },
  { label: "Copy", op: "copy" },
  { label: "Test", op: "test" },
] satisfies Array<{
  label: string;
  op: JsonPatchOperation["op"];
}>;

function valueToInput(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function inputToValue(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function pathSummary(operation: JsonPatchOperation) {
  if (operation.op === "copy" || operation.op === "move") {
    return `${operation.from || "/"} -> ${operation.path}`;
  }

  return operation.path || "/";
}

function fieldClassName(hasError = false) {
  return `h-9 rounded-lg border bg-[#09090B] px-3 font-mono text-xs text-zinc-100 outline-none transition ${
    hasError
      ? "border-red-400/70 focus:border-red-300"
      : "border-zinc-800 focus:border-emerald-400/70"
  }`;
}

function lockedFieldClassName(hasError = false) {
  return `h-9 truncate rounded-lg border bg-zinc-950/70 px-3 py-2 font-mono text-xs ${
    hasError ? "border-red-400/70 text-red-300" : "border-zinc-800 text-zinc-500"
  }`;
}

function AutoSizeValueEditor({
  operation,
  onUpdate,
}: {
  operation: JsonPatchOperation;
  onUpdate: (operation: JsonPatchOperation) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => valueToInput(operation.value));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }, [draftValue]);

  return (
    <textarea
      ref={textareaRef}
      className="jason-scrollbar min-h-9 resize-none overflow-y-auto rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 font-mono text-xs leading-5 text-zinc-100 outline-none transition focus:border-emerald-400/70"
      rows={1}
      value={draftValue}
      onBlur={() => {
        onUpdate({
          ...operation,
          value: inputToValue(draftValue),
        });
      }}
      onChange={(event) => {
        setDraftValue(event.target.value);
      }}
    />
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M9.8 3.1 12.9 6.2M2.9 10.1l-.6 3.6 3.6-.6 7.3-7.3a2.2 2.2 0 0 0-3.1-3.1l-7.2 7.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M3.5 8h9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.2 6.1A1.9 1.9 0 0 1 8.1 4.6c1 0 1.8.6 1.8 1.6 0 1.5-1.8 1.5-1.8 2.8M8 11.4h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function OperationQueuePanel({
  expandedIndex,
  onExpand,
  tool,
}: {
  expandedIndex: number | null;
  onExpand: (index: number | null) => void;
  tool: ReturnType<typeof usePatchTool>;
}) {
  const operationRefs = useRef<Array<HTMLElement | null>>([]);
  const issueByIndex = new Map(
    tool.patchOperationIssues.map((issue) => [issue.index, issue]),
  );

  useEffect(() => {
    if (expandedIndex === null) {
      return;
    }

    operationRefs.current[expandedIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [expandedIndex, tool.patchOperations.length]);

  return (
    <section className={`flex ${playgroundPanelHeightClass} min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900`}>
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-800 px-5">
        <h2 className="font-mono text-sm font-semibold text-zinc-50">JSON Patch</h2>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-xs font-semibold ${
              tool.patchState === "error" ? "text-red-400" : "text-zinc-400"
            }`}
          >
            {tool.patchOperations.length} queued
          </span>
          <span className="group relative">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
              aria-label="JSON Patch help"
              type="button"
            >
              <HelpIcon />
            </button>
            <span className="pointer-events-none absolute right-0 top-9 z-10 hidden w-64 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-left font-mono text-xs leading-5 text-zinc-300 shadow-2xl group-hover:block group-focus-within:block">
              Select a formatted JSON line, choose an operation, then edit the
              expanded queue card before applying.
            </span>
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-[#09090B] p-5">
        <div className="jason-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
          {tool.patchOperations.length ? (
            <div className="space-y-2">
              {tool.patchOperations.map((operation, index) => (
                <OperationCard
                  key={index}
                  cardRef={(node) => {
                    operationRefs.current[index] = node;
                  }}
                  expanded={expandedIndex === index}
                  index={index}
                  issue={issueByIndex.get(index)}
                  operation={operation}
                  onExpand={() => onExpand(expandedIndex === index ? null : index)}
                  onRemove={() => {
                    tool.handlePatchOperationRemove(index);
                    onExpand(null);
                  }}
                  onUpdate={(nextOperation) => {
                    tool.handlePatchOperationUpdate(index, nextOperation);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-800 px-8 text-center font-mono text-sm text-zinc-600">
              Select a document line, press +, then choose an operation.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OperationCard({
  cardRef,
  expanded,
  index,
  issue,
  operation,
  onExpand,
  onRemove,
  onUpdate,
}: {
  cardRef: (node: HTMLElement | null) => void;
  expanded: boolean;
  index: number;
  issue?: ReturnType<typeof usePatchTool>["patchOperationIssues"][number];
  operation: JsonPatchOperation;
  onExpand: () => void;
  onRemove: () => void;
  onUpdate: (operation: JsonPatchOperation) => void;
}) {
  const styles = operationStyles[operation.op];

  return (
    <article
      ref={cardRef}
      className={`overflow-hidden rounded-lg border border-l-[3px] bg-zinc-900/80 ${
        issue ? "border-red-400/70" : `border-zinc-700 ${styles.rail}`
      }`}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 px-2.5 py-2">
        <span className="min-w-0">
          <span className={`font-mono text-[11px] font-bold uppercase ${styles.text}`}>
            {String(index + 1).padStart(2, "0")} / {operation.op}
          </span>
          <span
            className={`mt-0.5 block truncate font-mono text-[11px] ${
              issue ? "text-red-300" : "text-zinc-400"
            }`}
          >
            {pathSummary(operation)}
          </span>
        </span>
        <button
          className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
            expanded
              ? "border-zinc-600 bg-zinc-800 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700"
              : "border-zinc-600 bg-zinc-950 text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
          }`}
          aria-label={expanded ? "Minimize patch operation" : "Edit patch operation"}
          title={expanded ? "Minimize" : "Edit"}
          type="button"
          onClick={onExpand}
        >
          {expanded ? <MinimizeIcon /> : <EditIcon />}
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-zinc-800 p-3">
          {(operation.op === "copy" || operation.op === "move") ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[11px] font-semibold uppercase text-zinc-500">
                  From
                </span>
                <span
                  className={lockedFieldClassName(issue?.field === "from")}
                  title={operation.from ?? ""}
                >
                  {operation.from ?? "/"}
                </span>
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[11px] font-semibold uppercase text-zinc-500">
                  To
                </span>
                <input
                  aria-invalid={issue?.field === "path"}
                  className={fieldClassName(issue?.field === "path")}
                  value={operation.path}
                  onChange={(event) => {
                    onUpdate({ ...operation, path: event.target.value });
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[11px] font-semibold uppercase text-zinc-500">
                Path
              </span>
              <span
                className={lockedFieldClassName(issue?.field === "path")}
                title={operation.path}
              >
                {operation.path || "/"}
              </span>
            </label>
          )}

          {issue ? (
            <p className="rounded-lg border border-red-400/40 bg-red-950/30 px-3 py-2 font-mono text-xs leading-5 text-red-300">
              {issue.message}
            </p>
          ) : null}

          {operation.op === "add" ||
          operation.op === "replace" ||
          operation.op === "test" ? (
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[11px] font-semibold uppercase text-zinc-500">
                Value
              </span>
              <AutoSizeValueEditor
                key={valueToInput(operation.value)}
                operation={operation}
                onUpdate={onUpdate}
              />
            </label>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-emerald-400/70 bg-emerald-500 px-4 font-mono text-xs font-bold text-zinc-950 transition hover:bg-emerald-400"
              type="button"
              onClick={onExpand}
            >
              Done
            </button>
            <button
              className="h-9 rounded-lg border border-red-400/50 px-3 font-mono text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
              type="button"
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function PatchView({ tool }: PatchViewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [operationPickerOpen, setOperationPickerOpen] = useState(false);

  function handleSelectOperation(op: JsonPatchOperation["op"]) {
    const nextIndex = tool.handlePatchOperationCreate(op);
    setOperationPickerOpen(false);

    if (typeof nextIndex === "number") {
      setExpandedIndex(nextIndex);
    }
  }

  function handleDocumentSelection(selection: { line: number; path: string }) {
    tool.handlePatchDocumentSelection(selection);
    setOperationPickerOpen(false);
  }

  const selectionAction =
    tool.selectedPatchLine && tool.selectedPatchPath
      ? {
          isOpen: operationPickerOpen,
          line: tool.selectedPatchLine,
          onToggle: () => {
            setOperationPickerOpen((open) => !open);
          },
          options: patchOperations.map((operation) => ({
            label: operation.label,
            onSelect: () => handleSelectOperation(operation.op),
            tone: operation.op,
          })),
          path: tool.selectedPatchPath,
        }
      : undefined;

  return (
    <>
      <CodePanel
        title="Document JSON"
        meta={tool.patchDocumentErrorLine ? `line ${tool.patchDocumentErrorLine}` : "input"}
        code={tool.patchDocumentInput}
        editable
        errorLine={tool.patchDocumentErrorLine}
        onChange={tool.handlePatchDocumentChange}
        onSubmit={() => {
          void tool.handlePatch();
        }}
        onSelectionChange={handleDocumentSelection}
        selectionAction={selectionAction}
        showLineNumbers
        tone={tool.patchDocumentErrorLine ? "error" : "default"}
      />
      <OperationQueuePanel
        expandedIndex={expandedIndex}
        tool={tool}
        onExpand={setExpandedIndex}
      />
      <CodePanel
        title="Patched Result"
        meta={
          tool.patchState === "thinking"
            ? "applying"
            : tool.patchState === "error"
              ? "patch error"
              : tool.patchOutput
                ? "preview"
                : "waiting"
        }
        code={
          tool.patchState === "error"
            ? `Jason couldn't apply this patch.\n\n${tool.patchError}`
            : tool.patchOutput || "Patched JSON will appear here."
        }
        highlightedLines={tool.patchResultHighlights}
        tone={
          tool.patchState === "error"
            ? "error"
            : tool.patchOutput
              ? "success"
              : "default"
        }
      />
    </>
  );
}
