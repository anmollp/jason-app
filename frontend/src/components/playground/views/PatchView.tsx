import { CodePanel } from "../CodePanel";
import type { usePatchTool } from "../hooks";

type PatchViewProps = {
  tool: ReturnType<typeof usePatchTool>;
};

export function PatchView({ tool }: PatchViewProps) {
  return (
    <>
      <CodePanel
        title="Document JSON"
        meta={tool.patchDocumentErrorLine ? `line ${tool.patchDocumentErrorLine}` : "input"}
        code={tool.patchDocumentInput}
        editable
        errorLine={tool.patchDocumentErrorLine}
        onChange={(value) => tool.handlePatchInputChange("document", value)}
        onSubmit={() => {
          void tool.handlePatch();
        }}
        showLineNumbers
        tone={tool.patchDocumentErrorLine ? "error" : "default"}
      />
      <CodePanel
        title="JSON Patch"
        meta={
          tool.patchOperationsErrorLine
            ? `line ${tool.patchOperationsErrorLine}`
            : "editable"
        }
        code={tool.patchOperationsInput}
        editable
        errorLine={tool.patchOperationsErrorLine}
        highlightedLines={tool.patchOperationHighlights}
        onChange={(value) => tool.handlePatchInputChange("patch", value)}
        onSubmit={() => {
          void tool.handlePatch();
        }}
        showLineNumbers
        tone={tool.patchOperationsErrorLine ? "error" : "default"}
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
