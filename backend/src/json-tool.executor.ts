import type {
  DiffJsonResponse,
  DiffJsonSummary,
  FormatJsonResponse,
  JsonPatchOperation,
  PatchJsonResponse,
  PatchJsonSummary,
  PointerJsonResponse,
} from './json-tools.types';

export type JasonJsonCommands = {
  format(input: string, signal?: AbortSignal): Promise<string>;
  diff(before: string, after: string, signal?: AbortSignal): Promise<string>;
  patch(document: string, patch: string, signal?: AbortSignal): Promise<string>;
  pointer(
    document: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string>;
};

export class JsonToolExecutor {
  constructor(private readonly jason: JasonJsonCommands) {}

  async formatJson(
    input: string,
    signal?: AbortSignal,
  ): Promise<FormatJsonResponse> {
    return {
      output: await (signal
        ? this.jason.format(input, signal)
        : this.jason.format(input)),
    };
  }

  async diffJson(
    before: string,
    after: string,
    signal?: AbortSignal,
  ): Promise<DiffJsonResponse> {
    const output = signal
      ? await this.jason.diff(before, after, signal)
      : await this.jason.diff(before, after);
    const operations = parsePatchOperations(output);

    return {
      operations,
      summary: summarizePatchOperations(operations),
    };
  }

  async patchJson(
    document: string,
    patch: string,
    signal?: AbortSignal,
  ): Promise<PatchJsonResponse> {
    const operations = parsePatchOperations(patch);

    return {
      operations,
      output: await (signal
        ? this.jason.patch(document, patch, signal)
        : this.jason.patch(document, patch)),
      summary: summarizePatchOperationsForPatch(operations),
    };
  }

  async pointerJson(
    document: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<PointerJsonResponse> {
    const output = signal
      ? await this.jason.pointer(document, path, signal)
      : await this.jason.pointer(document, path);
    const value = parseJsonValue(output);

    return {
      output,
      summary: {
        depth: pointerDepth(path),
        found: true,
        issues: 0,
        kind: jsonKind(value),
        path,
      },
    };
  }
}

function parseJsonValue(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(
      `pointer: ${error instanceof Error ? error.message : 'invalid JSON'}`,
    );
  }
}

function parsePatchOperations(output: string): JsonPatchOperation[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(
      `patch: ${error instanceof Error ? error.message : 'invalid JSON'}`,
    );
  }

  if (!Array.isArray(parsed) || !parsed.every(isPatchOperation)) {
    throw new Error('patch: Expected an array of JSON Patch operations.');
  }

  return parsed;
}

function isPatchOperation(value: unknown): value is JsonPatchOperation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const operation = value as Record<string, unknown>;

  if (typeof operation.op !== 'string' || typeof operation.path !== 'string') {
    return false;
  }

  if (operation.op === 'remove') {
    return true;
  }

  if (operation.op === 'move' || operation.op === 'copy') {
    return typeof operation.from === 'string';
  }

  return (
    (operation.op === 'add' ||
      operation.op === 'replace' ||
      operation.op === 'test') &&
    'value' in operation
  );
}

function jsonKind(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

function pointerDepth(path: string): number {
  return path ? path.split('/').slice(1).length : 0;
}

function summarizePatchOperations(
  operations: JsonPatchOperation[],
): DiffJsonSummary {
  return operations.reduce<DiffJsonSummary>(
    (summary, operation) => ({
      changes: summary.changes + 1,
      added: summary.added + (operation.op === 'add' ? 1 : 0),
      removed: summary.removed + (operation.op === 'remove' ? 1 : 0),
      replaced: summary.replaced + (operation.op === 'replace' ? 1 : 0),
    }),
    { changes: 0, added: 0, removed: 0, replaced: 0 },
  );
}

function summarizePatchOperationsForPatch(
  operations: JsonPatchOperation[],
): PatchJsonSummary {
  const summary = summarizePatchOperations(operations);

  return {
    operations: summary.changes,
    added: summary.added,
    removed: summary.removed,
    replaced: summary.replaced,
  };
}
