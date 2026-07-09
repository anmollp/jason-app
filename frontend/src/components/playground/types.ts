export type FormatterState = "idle" | "thinking" | "success" | "error";

export type LineHighlight = {
  line: number;
  tone: "add" | "remove" | "change";
};

export type FormatJsonResponse = {
  output: string;
};

export type PlaygroundErrorField = "after" | "before" | "document" | "patch" | "path";

export type FormatJsonErrorResponse = {
  detail?: string;
  field?: PlaygroundErrorField;
  message?: string;
};

export type JsonPatchOperation = {
  from?: string;
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
};

export type DiffJsonResponse = {
  operations: JsonPatchOperation[];
  summary: {
    added: number;
    changes: number;
    removed: number;
    replaced: number;
  };
};

export type PatchJsonResponse = {
  output: string;
  summary: {
    added: number;
    operations: number;
    removed: number;
    replaced: number;
  };
};

export type PointerJsonResponse = {
  output: string;
  summary: {
    depth: number;
    found: boolean;
    issues: number;
    kind: string;
    path: string;
  };
};
