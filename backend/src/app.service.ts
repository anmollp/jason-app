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
}

function parsePatchOperations(output: string): JsonPatchOperation[] {
  const parsed = JSON.parse(output) as unknown;

  if (!Array.isArray(parsed) || !parsed.every(isPatchOperation)) {
    throw new Error('Jason CLI returned an unexpected diff response.');
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
    operation.op === 'add' ||
    operation.op === 'replace' ||
    operation.op === 'test'
  );
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
