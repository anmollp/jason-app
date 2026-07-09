import { CodePanel } from "../CodePanel";
import type { usePointerTool } from "../hooks";

type PointerViewProps = {
  tool: ReturnType<typeof usePointerTool>;
};

export function PointerView({ tool }: PointerViewProps) {
  return (
    <>
      <CodePanel
        title="Source JSON"
        meta={tool.pointerDocumentErrorLine ? `line ${tool.pointerDocumentErrorLine}` : "editable"}
        code={tool.pointerDocumentInput}
        editable
        errorLine={tool.pointerDocumentErrorLine}
        highlightedLines={tool.pointerSourceHighlights}
        onChange={(value) => tool.handlePointerInputChange("document", value)}
        onSubmit={() => {
          void tool.handlePointer();
        }}
        showLineNumbers
        tone={tool.pointerDocumentErrorLine ? "error" : "default"}
      />
      <CodePanel
        title="Pointer Path"
        meta={tool.pointerPathErrorLine ? "check path" : "path"}
        code={tool.pointerPath}
        editable
        errorLine={tool.pointerPathErrorLine}
        onChange={(value) => tool.handlePointerInputChange("path", value)}
        onSubmit={() => {
          void tool.handlePointer();
        }}
        shouldWrapLines={false}
        showLineNumbers
        tone={tool.pointerPathErrorLine ? "error" : "default"}
      />
      <CodePanel
        title="Result"
        meta={
          tool.pointerState === "thinking"
            ? "finding"
            : tool.pointerState === "error"
              ? "not found"
              : tool.pointerOutput
                ? "result"
                : "waiting"
        }
        code={
          tool.pointerState === "error"
            ? `Jason couldn't resolve this pointer.\n\n${tool.pointerError}`
            : tool.pointerOutput || "Resolved value will appear here."
        }
        highlightedLines={
          tool.pointerState === "success"
            ? [{ line: 1, tone: "add" as const }]
            : []
        }
        tone={
          tool.pointerState === "error"
            ? "error"
            : tool.pointerOutput
              ? "success"
              : "default"
        }
      />
    </>
  );
}
