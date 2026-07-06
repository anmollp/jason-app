type CodePaneProps = {
  label: string;
  code: string;
  highlights?: Array<{
    line: number;
    marker: "+" | "-" | "~";
    tone: "add" | "remove" | "review";
  }>;
  meta?: string;
};

const highlightStyles = {
  add: "border-emerald-500/40 bg-emerald-500/12 text-emerald-100",
  remove: "border-red-500/40 bg-red-500/12 text-red-100",
  review: "border-amber-500/40 bg-amber-500/12 text-amber-100",
};

const markerStyles = {
  add: "text-emerald-400",
  remove: "text-red-400",
  review: "text-amber-400",
};

export function CodePane({ label, code, highlights = [], meta }: CodePaneProps) {
  const lines = code.split("\n");
  const highlightMap = new Map(highlights.map((highlight) => [highlight.line, highlight]));

  return (
    <article className="min-h-[286px] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
      <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-800 px-4">
        <h3 className="font-mono text-xs font-semibold text-zinc-50">{label}</h3>
        {meta ? (
          <span className="font-mono text-xs font-semibold text-zinc-500">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="bg-[#09090B] p-4">
        <div className="space-y-1 font-mono text-sm leading-6">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const highlight = highlightMap.get(lineNumber);

            return (
              <div
                key={`${lineNumber}-${line}`}
                className={`grid grid-cols-[2rem_1rem_minmax(0,1fr)] gap-2 rounded-md border px-2 py-0.5 ${
                  highlight
                    ? highlightStyles[highlight.tone]
                    : "border-transparent text-zinc-400"
                }`}
              >
                <span className="text-right text-zinc-600">
                  {String(lineNumber).padStart(2, "0")}
                </span>
                <span
                  className={highlight ? markerStyles[highlight.tone] : "text-zinc-700"}
                >
                  {highlight?.marker ?? " "}
                </span>
                <code className="min-w-0 whitespace-pre-wrap break-words">
                  {line}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
