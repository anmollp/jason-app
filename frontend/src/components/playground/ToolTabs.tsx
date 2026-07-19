export type PlaygroundTool = "Formatter" | "Diff" | "Patch" | "Pointer";

const tools: PlaygroundTool[] = ["Formatter", "Diff", "Patch", "Pointer"];

type ToolTabsProps = {
  activeTool: PlaygroundTool;
  onToolChange: (tool: PlaygroundTool) => void;
};

export function ToolTabs({ activeTool, onToolChange }: ToolTabsProps) {
  return (
    <div
      aria-label="JSON tools"
      className="inline-flex w-fit max-w-full self-start flex-wrap gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-1.5"
    >
      {tools.map((tool) => (
        <button
          key={tool}
          type="button"
          aria-pressed={activeTool === tool}
          className={`h-10 rounded-xl px-4 font-mono text-sm font-semibold transition ${
            activeTool === tool
              ? "bg-zinc-800 text-zinc-50"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          onClick={() => onToolChange(tool)}
        >
          {tool}
        </button>
      ))}
    </div>
  );
}
