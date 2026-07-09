import { CodePanel } from "../CodePanel";
import type { useDiffTool } from "../hooks";

type DiffViewProps = {
  tool: ReturnType<typeof useDiffTool>;
};

export function DiffView({ tool }: DiffViewProps) {
  return (
    <>
      <CodePanel
        title="Original JSON"
        meta={tool.beforeDiffErrorLine ? `line ${tool.beforeDiffErrorLine}` : "before"}
        code={tool.diffBeforeInput}
        editable
        errorLine={tool.beforeDiffErrorLine}
        highlightedLines={tool.beforeDiffHighlights}
        onChange={(value) => tool.handleDiffInputChange("before", value)}
        onSubmit={() => {
          void tool.handleDiff();
        }}
        showLineNumbers
        tone={tool.beforeDiffErrorLine ? "error" : "default"}
      />
      <CodePanel
        title="Changed JSON"
        meta={tool.afterDiffErrorLine ? `line ${tool.afterDiffErrorLine}` : "after"}
        code={tool.diffAfterInput}
        editable
        errorLine={tool.afterDiffErrorLine}
        highlightedLines={tool.afterDiffHighlights}
        onChange={(value) => tool.handleDiffInputChange("after", value)}
        onSubmit={() => {
          void tool.handleDiff();
        }}
        showLineNumbers
        tone={tool.afterDiffErrorLine ? "error" : "default"}
      />
    </>
  );
}
