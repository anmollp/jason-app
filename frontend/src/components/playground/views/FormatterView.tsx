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
        meta={
          tool.isOverPayloadLimit
            ? `${tool.payloadSizeLabel} / ${tool.payloadLimitLabel}`
            : tool.errorLine
              ? `line ${tool.errorLine}`
              : `${tool.payloadSizeLabel} / ${tool.payloadLimitLabel}`
        }
        code={tool.inputJson}
        editable
        errorLine={tool.errorLine}
        onChange={tool.handleInputChange}
        onSubmit={() => {
          void tool.handleFormat();
        }}
        showLineNumbers
        tone={tool.errorLine || tool.isOverPayloadLimit ? "error" : "default"}
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
        enableFolding={Boolean(tool.outputJson)}
        tone={
          tool.state === "error" ? "error" : tool.outputJson ? "success" : "default"
        }
      />
    </>
  );
}
