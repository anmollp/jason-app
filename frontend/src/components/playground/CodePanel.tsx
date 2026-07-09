"use client";

import { JsonCodeEditor } from "./JsonCodeEditor";

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
  errorLine?: number;
  highlightedLines?: Array<{
    line: number;
    tone: "add" | "remove" | "change";
  }>;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
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
  errorLine,
  highlightedLines = emptyHighlightedLines,
  onChange,
  onSubmit,
  shouldWrapLines = true,
  showLineNumbers = false,
  tone = "default",
}: CodePanelProps) {
  return (
    <section className="flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-800 px-5">
        <h2 className="font-mono text-sm font-semibold text-zinc-50">{title}</h2>
        <span className={`font-mono text-xs font-semibold ${toneStyles[tone]}`}>
          {meta}
        </span>
      </header>
      <div className="flex-1 bg-[#09090B] p-5">
        {editable ? (
          <JsonCodeEditor
            ariaLabel={title}
            errorLine={errorLine}
            highlightedLines={highlightedLines}
            onChange={onChange}
            onSubmit={onSubmit}
            shouldWrapLines={shouldWrapLines}
            showLineNumbers={showLineNumbers}
            tone={tone === "error" ? "error" : "default"}
            value={code}
          />
        ) : diffRows ? (
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
          <JsonCodeEditor
            ariaLabel={title}
            errorLine={errorLine}
            highlightedLines={highlightedLines}
            readOnly
            shouldWrapLines={shouldWrapLines}
            showLineNumbers
            tone={tone === "error" ? "error" : "default"}
            value={code}
          />
        )}
      </div>
    </section>
  );
}
