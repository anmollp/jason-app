import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_VERSION,
} from '../contracts/tool-contracts';
import type {
  RoutingEvalRunOptions,
  RoutingEvalSessionCostSummary,
  RoutingEvalSessionResult,
} from './routing-eval-runner';
import type {
  RoutingEvalCaseResult,
  RoutingEvalModel,
  RoutingEvalSummary,
} from './routing-eval';

export type RoutingEvalPrivateCase = RoutingEvalCaseResult & {
  reviewHash: string;
};

export type RoutingEvalPrivateReport = {
  schemaVersion: 1;
  generatedAt: string;
  promptVersion: typeof AGENT_PROMPT_VERSION;
  contractVersion: typeof AGENT_CONTRACT_VERSION;
  model: RoutingEvalModel;
  runOptions: Required<Pick<RoutingEvalRunOptions, 'turnsPerSession'>>;
  summary: RoutingEvalSummary;
  sessions: RoutingEvalSessionResult[];
  sessionCost: RoutingEvalSessionCostSummary;
  fatalError?: string;
  cases: RoutingEvalPrivateCase[];
  evidenceHash: string;
};

export type RoutingEvalJudgment = { reviewHash: string; pass: boolean };
export type RoutingEvalJudgments = Record<string, RoutingEvalJudgment>;

export type ReservedJsonReport = {
  write(value: unknown): Promise<void>;
};

export function createPrivateEvalReport(
  result: {
    cases: RoutingEvalCaseResult[];
    sessions: RoutingEvalSessionResult[];
    sessionCost: RoutingEvalSessionCostSummary;
    summary: RoutingEvalSummary;
    fatalError?: string;
  },
  model: RoutingEvalModel,
  runOptions: Required<Pick<RoutingEvalRunOptions, 'turnsPerSession'>>,
  generatedAt = new Date(),
): RoutingEvalPrivateReport {
  const evidence = {
    schemaVersion: 1 as const,
    generatedAt: generatedAt.toISOString(),
    promptVersion: AGENT_PROMPT_VERSION,
    contractVersion: AGENT_CONTRACT_VERSION,
    model,
    runOptions,
    summary: result.summary,
    sessions: result.sessions,
    sessionCost: result.sessionCost,
    ...(result.fatalError ? { fatalError: result.fatalError } : {}),
    cases: result.cases.map((item) => ({
      ...item,
      reviewHash: reviewHash(item),
    })),
  };
  return { ...evidence, evidenceHash: hashValue(evidence) };
}

export function finalizeEvalReport(
  report: RoutingEvalPrivateReport,
  judgments: RoutingEvalJudgments,
) {
  const { evidenceHash, ...evidence } = report;
  if (evidenceHash !== hashValue(evidence)) {
    throw new Error('Private eval evidence changed after generation.');
  }
  const knownIds = new Set(report.cases.map((item) => item.id));
  for (const id of Object.keys(judgments)) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown eval judgment: ${id}`);
    }
  }

  const cases = report.cases.map((item) => {
    if (reviewHash(item) !== item.reviewHash) {
      throw new Error(`Eval case changed after generation: ${item.id}`);
    }
    const judgment = judgments[item.id];
    if (judgment && judgment.reviewHash !== item.reviewHash) {
      throw new Error(`Eval judgment does not match response: ${item.id}`);
    }
    const { responseText, ...publicCase } = item;
    void responseText;
    return { ...publicCase, semanticPass: judgment?.pass ?? null };
  });
  const pending = cases
    .filter((item) => item.semanticPass === null)
    .map((item) => item.id);
  const failed = cases
    .filter((item) => item.semanticPass === false)
    .map((item) => item.id);
  const automaticThresholdsPass = Object.values(
    report.summary.thresholds,
  ).every(Boolean);
  const sessionCostPass =
    report.model !== 'gpt-5.6-luna' ||
    report.sessionCost.belowThirtyMilliUsd === true;
  const completeSessionEvidence =
    report.runOptions.turnsPerSession === 3 &&
    report.sessions.length === 20 &&
    report.sessionCost.sessions === 20 &&
    report.sessions.every(
      (session) =>
        session.turns === 3 &&
        session.caseIds.length === 3 &&
        session.usageEvidenceValid &&
        (report.model !== 'gpt-5.6-luna' ||
          session.estimatedCostMicroUsd !== null),
    );

  return {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    finalizedAt: new Date().toISOString(),
    promptVersion: report.promptVersion,
    contractVersion: report.contractVersion,
    model: report.model,
    summary: report.summary,
    sessionCost: report.sessionCost,
    semanticReview: {
      reviewed: cases.length - pending.length,
      required: cases.length,
      pending,
      failed,
    },
    ready:
      report.cases.length === 60 &&
      report.summary.cases === 60 &&
      completeSessionEvidence &&
      report.fatalError === undefined &&
      automaticThresholdsPass &&
      sessionCostPass &&
      pending.length === 0 &&
      failed.length === 0,
    cases,
  };
}

export async function readPrivateEvalReport(
  path: string,
): Promise<RoutingEvalPrivateReport> {
  const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.promptVersion !== AGENT_PROMPT_VERSION ||
    value.contractVersion !== AGENT_CONTRACT_VERSION ||
    (value.model !== 'gpt-5.6-luna' && value.model !== 'gpt-5.6-terra') ||
    !Array.isArray(value.cases) ||
    !Array.isArray(value.sessions) ||
    !isRecord(value.runOptions) ||
    (value.runOptions.turnsPerSession !== 1 &&
      value.runOptions.turnsPerSession !== 3) ||
    !isRecord(value.summary) ||
    !isRecord(value.sessionCost) ||
    typeof value.evidenceHash !== 'string'
  ) {
    throw new Error('The private eval report is invalid or incompatible.');
  }
  for (const item of value.cases) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.responseText !== 'string' ||
      typeof item.reviewHash !== 'string'
    ) {
      throw new Error('The private eval report contains an invalid case.');
    }
  }
  return value as RoutingEvalPrivateReport;
}

export function parseEvalJudgments(
  value: unknown,
  caseIds: readonly string[],
): RoutingEvalJudgments {
  if (!isRecord(value)) {
    throw new Error('Eval judgments must be a JSON object.');
  }
  const knownIds = new Set(caseIds);
  for (const [id, judgment] of Object.entries(value)) {
    if (
      !knownIds.has(id) ||
      !isRecord(judgment) ||
      typeof judgment.reviewHash !== 'string' ||
      typeof judgment.pass !== 'boolean'
    ) {
      throw new Error('Eval judgments must map known cases to hash and pass.');
    }
  }
  return value as RoutingEvalJudgments;
}

export async function writeJsonAtomically(
  path: string,
  value: unknown,
): Promise<void> {
  const reservation = await reserveJsonReport(path);
  await reservation.write(value);
}

export async function reserveJsonReport(
  path: string,
): Promise<ReservedJsonReport> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const reservation = `askjason-eval-reservation:${randomUUID()}\n`;
  await writeFile(path, reservation, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });

  let completed = false;
  return {
    async write(value: unknown): Promise<void> {
      if (completed || (await readFile(path, 'utf8')) !== reservation) {
        throw new Error('The reserved report path is no longer available.');
      }
      const temporaryPath = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
      try {
        await rename(temporaryPath, path);
        completed = true;
      } finally {
        await unlink(temporaryPath).catch(() => undefined);
      }
    },
  };
}

function reviewHash(item: RoutingEvalCaseResult): string {
  const { reviewHash: ignored, ...value } = item as RoutingEvalPrivateCase;
  void ignored;
  return hashValue(value);
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
