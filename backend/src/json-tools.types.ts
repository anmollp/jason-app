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

export type HealthResponse = {
  name: string;
  status: 'ok';
  version: string;
};
