const tools = ["Formatter", "Diff", "Patch", "Pointer"];

export function ToolTabs() {
  return (
    <div
      aria-label="JSON tools"
      className="inline-flex flex-wrap gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-1.5"
    >
      {tools.map((tool, index) => (
        <button
          key={tool}
          type="button"
          className={`h-10 rounded-xl px-4 font-mono text-sm font-semibold transition ${
            index === 0
              ? "bg-zinc-800 text-zinc-50"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {tool}
        </button>
      ))}
    </div>
  );
}
