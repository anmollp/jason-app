import type { AgentToolName } from '../contracts/tool-contracts';
import type { RoutingFixture } from './routing-fixtures';

export type RoutingEvalModel = 'gpt-5.6-luna' | 'gpt-5.6-terra';

export type RoutingEvalCaseResult = {
  id: string;
  category: RoutingFixture['category'];
  expected: RoutingFixture['expected'];
  observedTools: AgentToolName[];
  toolCalls: Array<{
    callId: string;
    tool: AgentToolName;
    schemaValid: boolean;
  }>;
  responseText: string;
  routingPass: boolean;
  schemaValid: boolean;
  patchProposalValid: boolean | null;
  patchProposalCount: number;
  validPatchProposalCount: number;
  usageEvidenceValid: boolean;
  completedRounds: number;
  usageRecords: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedCostMicroUsd: number | null;
  error?: string;
};

export type RoutingEvalSummary = {
  model: RoutingEvalModel;
  cases: number;
  routingAccuracy: number;
  schemaValidity: number;
  patchProposalValidity: number;
  usageEvidenceValidity: number;
  p95TurnCostMicroUsd: number | null;
  categories: Record<
    RoutingFixture['category'],
    { cases: number; passed: number; accuracy: number }
  >;
  thresholds: {
    routingAccuracy: boolean;
    schemaValidity: boolean;
    patchProposalValidity: boolean;
    usageEvidence: boolean;
    errorFree: boolean;
  };
};

export function summarizeRoutingEval(
  cases: readonly RoutingEvalCaseResult[],
  model: RoutingEvalModel,
): RoutingEvalSummary {
  const routingAccuracy = ratio(
    cases.filter((item) => item.routingPass).length,
    cases.length,
  );
  const calls = cases.flatMap((item) => item.toolCalls);
  const validCalls = calls.filter((call) => call.schemaValid).length;
  const patchProposalCount = cases.reduce(
    (count, item) => count + item.patchProposalCount,
    0,
  );
  const validPatchProposalCount = cases.reduce(
    (count, item) => count + item.validPatchProposalCount,
    0,
  );
  const patchProposalValidity = ratio(
    validPatchProposalCount,
    patchProposalCount,
  );
  const usageEvidenceValidity = ratio(
    cases.filter((item) => item.usageEvidenceValid).length,
    cases.length,
  );
  const lunaCosts = cases.flatMap((item) =>
    item.estimatedCostMicroUsd === null ? [] : [item.estimatedCostMicroUsd],
  );
  const p95TurnCostMicroUsd =
    model === 'gpt-5.6-luna' && lunaCosts.length === cases.length
      ? percentile(lunaCosts, 0.95)
      : null;
  const categories = Object.fromEntries(
    (
      [
        'formatter',
        'diff',
        'patch',
        'pointer',
        'ambiguous',
        'injection',
      ] as const
    ).map((category) => {
      const categoryCases = cases.filter((item) => item.category === category);
      const passed = categoryCases.filter((item) => item.routingPass).length;
      return [
        category,
        {
          cases: categoryCases.length,
          passed,
          accuracy: ratio(passed, categoryCases.length),
        },
      ];
    }),
  ) as RoutingEvalSummary['categories'];

  return {
    model,
    cases: cases.length,
    routingAccuracy,
    schemaValidity: ratio(validCalls, calls.length),
    patchProposalValidity,
    usageEvidenceValidity,
    p95TurnCostMicroUsd,
    categories,
    thresholds: {
      routingAccuracy: routingAccuracy >= 0.9,
      schemaValidity: validCalls === calls.length && calls.length > 0,
      patchProposalValidity:
        patchProposalCount > 0 && patchProposalValidity === 1,
      usageEvidence:
        cases.length > 0 && cases.every((item) => item.usageEvidenceValid),
      errorFree: cases.every((item) => item.error === undefined),
    },
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percentile(values: readonly number[], value: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * value) - 1] ?? 0;
}
