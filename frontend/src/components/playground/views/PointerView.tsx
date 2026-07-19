import { CodePanel } from "../CodePanel";
import type { usePointerTool } from "../hooks";

type PointerViewProps = {
  tool: ReturnType<typeof usePointerTool>;
};

export function PointerView({ tool }: PointerViewProps) {
  const hasPathError =
    tool.pointerState === "error" && !tool.pointerDocumentErrorLine;

  return (
    <CodePanel
      title="Source JSON"
      meta={
        tool.pointerDocumentErrorLine
          ? `line ${tool.pointerDocumentErrorLine}`
          : "select a value"
      }
      code={tool.pointerDocumentInput}
      editable
      editorOverlay={
        <div className="absolute right-4 top-4 z-10 w-[min(400px,calc(100%-2rem))]">
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-3 -translate-y-1/2 rounded-full border border-zinc-400 after:absolute after:-bottom-1 after:-right-1 after:h-1.5 after:w-px after:-rotate-45 after:bg-zinc-400"
          />
          <input
            aria-invalid={hasPathError}
            aria-label="Search JSON Pointer path"
            className={`h-9 w-full rounded-md border bg-zinc-950 py-2 pl-9 pr-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${
              hasPathError
                ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                : "border-zinc-700"
            }`}
            onChange={(event) =>
              tool.handlePointerInputChange("path", event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void tool.handlePointer();
              }
            }}
            placeholder="/path/to/value"
            type="search"
            value={tool.pointerPath}
          />
        </div>
      }
      errorLine={tool.pointerDocumentErrorLine}
      highlightedLines={tool.pointerSourceHighlights}
      onChange={(value) => tool.handlePointerInputChange("document", value)}
      onSelectionChange={(selection) => {
        if (selection.path) {
          tool.handlePointerInputChange("path", selection.path);
        }
      }}
      onSubmit={() => {
        void tool.handlePointer();
      }}
      showLineNumbers
      tone={tool.pointerDocumentErrorLine ? "error" : "default"}
    />
  );
}
