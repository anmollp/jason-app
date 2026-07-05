"use client";

import { useMemo, useRef } from "react";

type CodePanelProps = {
  title: string;
  meta: string;
  code: string;
  editable?: boolean;
  errorLine?: number;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  showLineNumbers?: boolean;
  tone?: "default" | "success" | "error";
};

const toneStyles = {
  default: "text-zinc-400",
  success: "text-emerald-400",
  error: "text-red-400",
};

export function CodePanel({
  title,
  meta,
  code,
  editable = false,
  errorLine,
  onChange,
  onSubmit,
  showLineNumbers = false,
  tone = "default",
}: CodePanelProps) {
  const lineNumberRef = useRef<HTMLDivElement>(null);
  const lineNumbers = useMemo(
    () =>
      Array.from(
        { length: Math.max(code.split(/\r?\n/).length, 1) },
        (_, index) => index + 1,
      ),
    [code],
  );

  function syncLineNumberScroll(scrollTop: number) {
    if (!lineNumberRef.current) {
      return;
    }

    lineNumberRef.current.style.transform = `translateY(-${scrollTop}px)`;
  }

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
          <div className="flex h-full min-h-[330px] overflow-hidden">
            {showLineNumbers ? (
              <div className="w-10 shrink-0 overflow-hidden border-r border-zinc-800 pr-3 text-right font-mono text-sm leading-6 text-zinc-600 select-none">
                <div ref={lineNumberRef}>
                  {lineNumbers.map((lineNumber) => (
                    <div
                      key={lineNumber}
                      className={
                        lineNumber === errorLine
                          ? "font-semibold text-red-400"
                          : undefined
                      }
                    >
                      {lineNumber}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <textarea
              aria-label={title}
              className="h-full min-h-[330px] w-full resize-none bg-transparent pl-4 font-mono text-sm leading-6 text-zinc-300 outline-none placeholder:text-zinc-600"
              spellCheck={false}
              value={code}
              onChange={(event) => onChange?.(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onSubmit?.();
                }
              }}
              onScroll={(event) => {
                syncLineNumberScroll(event.currentTarget.scrollTop);
              }}
              placeholder="Paste JSON here..."
            />
          </div>
        ) : (
          <pre
            className={`h-full overflow-auto whitespace-pre-wrap font-mono text-sm leading-6 ${
              tone === "error" ? "text-red-400" : "text-zinc-300"
            }`}
          >
            <code>{code}</code>
          </pre>
        )}
      </div>
    </section>
  );
}
