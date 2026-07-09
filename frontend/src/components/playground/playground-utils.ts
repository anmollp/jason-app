import type { JsonPatchOperation, LineHighlight } from "./types";

export function countJsonKeys(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countJsonKeys(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce(
      (count, [, child]) => count + 1 + countJsonKeys(child),
      0,
    );
  }

  return 0;
}

export function countLines(value: string) {
  return value.trim() ? value.split(/\r?\n/).length : 0;
}

export function parseErrorLine(message: string) {
  const match = message.match(/\bline\s+(\d+)\b/i);
  const line = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(line) && line > 0 ? line : undefined;
}

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function lineForJsonPointer(input: string, path: string) {
  if (!path) {
    return input.trim() ? 1 : undefined;
  }

  const segments = path.split("/").slice(1).map(decodePointerSegment);
  const target = segments.at(-1);

  if (!target) {
    return undefined;
  }

  const lines = input.split(/\r?\n/);
  const quotedTarget = `"${target.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const targetIndex = lines.findIndex((line) => line.includes(quotedTarget));

  if (targetIndex >= 0) {
    return targetIndex + 1;
  }

  const arrayIndex = Number(target);

  if (Number.isInteger(arrayIndex) && arrayIndex >= 0) {
    return Math.min(arrayIndex + 2, lines.length);
  }

  return undefined;
}

export function buildDiffHighlights(
  input: string,
  operations: JsonPatchOperation[] | undefined,
  side: "before" | "after",
): LineHighlight[] {
  if (!operations) {
    return [];
  }

  const highlights = operations.flatMap<LineHighlight>((operation) => {
    const line = lineForJsonPointer(input, operation.path);

    if (!line) {
      return [];
    }

    if (operation.op === "replace") {
      return [{ line, tone: "change" as const }];
    }

    if (side === "before" && operation.op === "remove") {
      return [{ line, tone: "remove" as const }];
    }

    if (side === "after" && operation.op === "add") {
      return [{ line, tone: "add" as const }];
    }

    return [];
  });

  return Array.from(
    new Map(highlights.map((highlight) => [highlight.line, highlight])).values(),
  );
}

export function parsePatchOperations(input: string): JsonPatchOperation[] {
  try {
    const parsed = JSON.parse(input) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is JsonPatchOperation => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const operation = item as Record<string, unknown>;

      return typeof operation.op === "string" && typeof operation.path === "string";
    });
  } catch {
    return [];
  }
}

export function buildPatchOperationHighlights(input: string): LineHighlight[] {
  return input.split(/\r?\n/).flatMap<LineHighlight>((line, index) => {
    const match = line.match(/"op"\s*:\s*"(add|remove|replace)"/);

    if (!match) {
      return [];
    }

    const [, op] = match;

    return [
      {
        line: index + 1,
        tone:
          op === "add"
            ? "add"
            : op === "remove"
              ? "remove"
              : "change",
      },
    ];
  });
}

export function primaryPointerPath(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

export function pointerDepth(path: string) {
  return path ? path.split("/").slice(1).length : 0;
}
