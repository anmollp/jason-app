import { Injectable } from '@nestjs/common';
import { JasonCliService } from './jason-cli.service';

export type FormatJsonRequest = {
  input: string;
};

export type FormatJsonResponse = {
  output: string;
};

type JsonPatchValueOperation = {
  op: 'add' | 'replace' | 'test';
  path: string;
  value: unknown;
};

type JsonPatchPathOperation = {
  op: 'remove';
  path: string;
};

type JsonPatchFromOperation = {
  op: 'move' | 'copy';
  from: string;
  path: string;
};

export type JsonPatchOperation =
  | JsonPatchValueOperation
  | JsonPatchPathOperation
  | JsonPatchFromOperation;

export type DiffJsonRequest = {
  before: string;
  after: string;
};

export type DiffJsonSummary = {
  changes: number;
  added: number;
  removed: number;
  replaced: number;
};

export type DiffJsonResponse = {
  operations: JsonPatchOperation[];
  summary: DiffJsonSummary;
};

export type PatchJsonRequest = {
  document: string;
  patch: string;
};

export type PatchJsonSummary = {
  operations: number;
  added: number;
  removed: number;
  replaced: number;
};

export type PatchJsonResponse = {
  output: string;
  summary: PatchJsonSummary;
};

export type PointerJsonRequest = {
  document: string;
  path: string;
};

export type PointerJsonSummary = {
  depth: number;
  found: boolean;
  issues: number;
  kind: string;
  path: string;
};

export type PointerJsonResponse = {
  output: string;
  summary: PointerJsonSummary;
};

@Injectable()
export class AppService {
  constructor(private readonly jasonCliService: JasonCliService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async formatJson(input: string): Promise<FormatJsonResponse> {
    return {
      output: await this.jasonCliService.format(input),
    };
  }

  async diffJson(before: string, after: string): Promise<DiffJsonResponse> {
    const output = await this.jasonCliService.diff(before, after);
    const operations = parsePatchOperations(output);

    return {
      operations,
      summary: summarizePatchOperations(operations),
    };
  }

  async patchJson(document: string, patch: string): Promise<PatchJsonResponse> {
    const operations = parsePatchOperations(patch);

    return {
      output: await this.jasonCliService.patch(document, patch),
      summary: summarizePatchOperationsForPatch(operations),
    };
  }

  async pointerJson(
    document: string,
    path: string,
  ): Promise<PointerJsonResponse> {
    const output = await this.jasonCliService.pointer(document, path);
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
  if (!path) {
    return 0;
  }

  return path.split('/').slice(1).length;
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
    {
      changes: 0,
      added: 0,
      removed: 0,
      replaced: 0,
    },
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
