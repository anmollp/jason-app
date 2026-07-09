import { CodePanel } from "../CodePanel";
import type { useFormatterTool } from "../hooks";

type FormatterViewProps = {
  tool: ReturnType<typeof useFormatterTool>;
};

export function FormatterView({ tool }: FormatterViewProps) {
  return (
    <>
      <CodePanel
        title="Input JSON"
        meta={tool.errorLine ? `line ${tool.errorLine}` : "editable"}
        code={tool.inputJson}
        editable
        errorLine={tool.errorLine}
        onChange={tool.handleInputChange}
        onSubmit={() => {
          void tool.handleFormat();
        }}
        showLineNumbers
        tone={tool.errorLine ? "error" : "default"}
      />
      <CodePanel
        title="Formatted Output"
        meta={
          tool.state === "thinking"
            ? "formatting"
            : tool.state === "error"
              ? "parse error"
              : tool.outputJson
                ? "formatted"
                : "waiting"
        }
        code={tool.outputCode}
        tone={
          tool.state === "error" ? "error" : tool.outputJson ? "success" : "default"
        }
      />
    </>
  );
}
