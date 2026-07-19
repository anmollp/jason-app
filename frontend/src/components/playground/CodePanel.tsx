"use client";

import { JsonCodeEditor } from "./JsonCodeEditor";
import type { SelectionAction } from "./JsonSelectionActions";

type CodePanelProps = {
  title: string;
  meta: string;
  code: string;
  diffRows?: Array<{
    code: string;
    line: number;
    marker?: "+" | "-" | "~";
    tone?: "neutral" | "add" | "remove" | "change";
  }>;
  editable?: boolean;
  enableFolding?: boolean;
  errorLine?: number;
  highlightedLines?: Array<{
    line: number;
    tone: "add" | "remove" | "change";
  }>;
  onChange?: (value: string) => void;
  onSelectionChange?: (selection: {
    line: number;
    path: string;
  }) => void;
  onSubmit?: () => void;
  selectionAction?: SelectionAction;
  shouldWrapLines?: boolean;
  showLineNumbers?: boolean;
  tone?: "default" | "success" | "error";
};

const toneStyles = {
  default: "text-zinc-400",
  success: "text-emerald-400",
  error: "text-red-400",
};

const diffRowStyles = {
  add: "border-emerald-500/40 bg-emerald-950/70 text-emerald-200",
  change: "border-amber-500/40 bg-amber-950/70 text-amber-200",
  neutral: "border-transparent text-zinc-300",
  remove: "border-red-500/40 bg-red-950/70 text-red-200",
};

const diffMarkerStyles = {
  add: "text-emerald-400",
  change: "text-amber-400",
  neutral: "text-zinc-600",
  remove: "text-red-400",
};

const emptyHighlightedLines: NonNullable<CodePanelProps["highlightedLines"]> = [];

export function CodePanel({
  title,
  meta,
  code,
  diffRows,
  editable = false,
  enableFolding = false,
  errorLine,
  highlightedLines = emptyHighlightedLines,
  onChange,
  onSelectionChange,
  onSubmit,
  selectionAction,
  shouldWrapLines = true,
  showLineNumbers = false,
  tone = "default",
}: CodePanelProps) {
  return (
    <section className="flex h-[clamp(420px,46vh,560px)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-800 px-5">
        <h2 className="font-mono text-sm font-semibold text-zinc-50">{title}</h2>
        <span className={`font-mono text-xs font-semibold ${toneStyles[tone]}`}>
          {meta}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#09090B] p-5">
        {!editable && diffRows ? (
          <div className="space-y-1 font-mono text-sm leading-6">
            {diffRows.map((row) => {
              const tone = row.tone ?? "neutral";

              return (
                <div
                  key={`${row.line}-${row.code}`}
                  className={`grid grid-cols-[2rem_1rem_minmax(0,1fr)] gap-2 rounded-md border px-2 py-1 ${diffRowStyles[tone]}`}
                >
                  <span className="text-zinc-600">
                    {String(row.line).padStart(2, "0")}
                  </span>
                  <span className={diffMarkerStyles[tone]}>
                    {row.marker ?? " "}
                  </span>
                  <code className="min-w-0 whitespace-pre-wrap break-words">
                    {row.code}
                  </code>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <JsonCodeEditor
              ariaLabel={title}
              errorLine={errorLine}
              enableFolding={!editable && enableFolding}
              highlightedLines={highlightedLines}
              onChange={editable ? onChange : undefined}
              onSelectionChange={editable ? onSelectionChange : undefined}
              onSubmit={editable ? onSubmit : undefined}
              readOnly={!editable}
              selectionAction={editable ? selectionAction : undefined}
              shouldWrapLines={shouldWrapLines}
              showLineNumbers={editable ? showLineNumbers : true}
              tone={tone === "error" ? "error" : "default"}
              value={code}
            />
          </div>
        )}
      </div>
    </section>
  );
}
