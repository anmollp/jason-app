type CodePanelProps = {
  title: string;
  meta: string;
  code: string;
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
        <pre
          className={`h-full overflow-auto whitespace-pre-wrap font-mono text-sm leading-6 ${
            tone === "error" ? "text-red-400" : "text-zinc-400"
          }`}
        >
          <code>{code}</code>
        </pre>
      </div>
    </section>
  );
}
