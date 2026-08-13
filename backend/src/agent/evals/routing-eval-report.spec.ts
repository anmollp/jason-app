import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RoutingEvalCaseResult } from './routing-eval';
import {
  createPrivateEvalReport,
  finalizeEvalReport,
  reserveJsonReport,
  writeJsonAtomically,
} from './routing-eval-report';

describe('routing eval reports', () => {
  it('binds offline judgments to the exact reviewed response', () => {
    const report = privateReport();
    const item = report.cases[0];
    const finalized = finalizeEvalReport(report, {
      [item.id]: { reviewHash: item.reviewHash, pass: true },
    });

    expect(finalized.cases[0]).toMatchObject({
      reviewHash: item.reviewHash,
      semanticPass: true,
    });
    expect(finalized.cases[0]).not.toHaveProperty('responseText');
  });

  it('rejects a judgment from a different response', () => {
    const report = privateReport();
    expect(() =>
      finalizeEvalReport(report, {
        'case-1': { reviewHash: '0'.repeat(64), pass: true },
      }),
    ).toThrow('does not match response');
  });

  it('rejects a private response changed after generation', () => {
    const report = privateReport();
    report.cases[0].responseText = 'Changed response.';
    expect(() => finalizeEvalReport(report, {})).toThrow(
      'changed after generation',
    );
  });

  it('rejects altered automatic evidence', () => {
    const report = privateReport();
    report.sessionCost.belowThirtyMilliUsd = true;
    expect(() => finalizeEvalReport(report, {})).toThrow(
      'evidence changed after generation',
    );
  });

  it('writes parseable JSON without overwriting prior evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'askjason-eval-'));
    const path = join(directory, 'report.json');
    await writeJsonAtomically(path, { ready: false });

    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ready: false });
    await expect(writeJsonAtomically(path, { ready: true })).rejects.toThrow();
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ready: false });
  });

  it('reserves a report path before evidence generation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'askjason-eval-'));
    const path = join(directory, 'reserved.json');
    const reservation = await reserveJsonReport(path);

    await expect(reserveJsonReport(path)).rejects.toThrow();
    await reservation.write({ complete: true });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      complete: true,
    });
  });

  it.each(['gpt-5.6-luna', 'gpt-5.6-terra'] as const)(
    'accepts complete 20-session evidence for %s',
    (model) => {
      const report = completeReport(model);
      const judgments = Object.fromEntries(
        report.cases.map((item) => [
          item.id,
          { reviewHash: item.reviewHash, pass: true },
        ]),
      );

      expect(finalizeEvalReport(report, judgments).ready).toBe(true);
    },
  );
});

function privateReport() {
  const cases = [caseResult()];
  return createPrivateEvalReport(
    {
      cases,
      sessions: [
        {
          id: 'session-1',
          caseIds: ['case-1'],
          turns: 1,
          usageEvidenceValid: true,
          estimatedCostMicroUsd: 100,
        },
      ],
      sessionCost: {
        sessions: 1,
        p95SessionCostMicroUsd: null,
        belowThirtyMilliUsd: null,
      },
      summary: {
        model: 'gpt-5.6-luna',
        cases: 1,
        routingAccuracy: 1,
        schemaValidity: 1,
        patchProposalValidity: 1,
        usageEvidenceValidity: 1,
        p95TurnCostMicroUsd: 100,
        categories: {
          formatter: { cases: 1, passed: 1, accuracy: 1 },
          diff: { cases: 0, passed: 0, accuracy: 0 },
          patch: { cases: 0, passed: 0, accuracy: 0 },
          pointer: { cases: 0, passed: 0, accuracy: 0 },
          ambiguous: { cases: 0, passed: 0, accuracy: 0 },
          injection: { cases: 0, passed: 0, accuracy: 0 },
        },
        thresholds: {
          routingAccuracy: true,
          schemaValidity: true,
          patchProposalValidity: true,
          usageEvidence: true,
          errorFree: true,
        },
      },
    },
    'gpt-5.6-luna',
    { turnsPerSession: 1 },
    new Date('2026-08-13T00:00:00.000Z'),
  );
}

function completeReport(model: 'gpt-5.6-luna' | 'gpt-5.6-terra') {
  const cases = Array.from({ length: 60 }, (_, index) =>
    caseResult(index + 1, model),
  );
  const sessions = Array.from({ length: 20 }, (_, index) => ({
    id: `session-${index + 1}`,
    caseIds: cases.slice(index * 3, index * 3 + 3).map((item) => item.id),
    turns: 3,
    usageEvidenceValid: true,
    estimatedCostMicroUsd: model === 'gpt-5.6-luna' ? 96 : null,
  }));
  const summary = privateReport().summary;
  return createPrivateEvalReport(
    {
      cases,
      sessions,
      sessionCost: {
        sessions: 20,
        p95SessionCostMicroUsd: model === 'gpt-5.6-luna' ? 96 : null,
        belowThirtyMilliUsd: model === 'gpt-5.6-luna' ? true : null,
      },
      summary: {
        ...summary,
        model,
        cases: 60,
        categories: {
          ...summary.categories,
          formatter: { cases: 60, passed: 60, accuracy: 1 },
        },
      },
    },
    model,
    { turnsPerSession: 3 },
  );
}

function caseResult(
  index = 1,
  model: 'gpt-5.6-luna' | 'gpt-5.6-terra' = 'gpt-5.6-luna',
): RoutingEvalCaseResult {
  return {
    id: `case-${index}`,
    category: 'formatter',
    expected: { decision: 'tool', tool: 'format_json' },
    observedTools: ['format_json'],
    toolCalls: [{ callId: 'call-1', tool: 'format_json', schemaValid: true }],
    responseText: 'Formatted.',
    routingPass: true,
    schemaValid: true,
    patchProposalValid: null,
    patchProposalCount: 0,
    validPatchProposalCount: 0,
    usageEvidenceValid: true,
    completedRounds: 2,
    usageRecords: 2,
    inputTokens: 100,
    outputTokens: 10,
    cachedInputTokens: 0,
    estimatedCostMicroUsd: model === 'gpt-5.6-luna' ? 32 : null,
  };
}
