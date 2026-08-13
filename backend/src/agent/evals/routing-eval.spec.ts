import type { RoutingEvalCaseResult } from './routing-eval';
import { summarizeRoutingEval } from './routing-eval';

describe('summarizeRoutingEval', () => {
  it('calculates routing thresholds and informational p95 Luna turn cost', () => {
    const cases = Array.from({ length: 20 }, (_, index) =>
      result({
        id: `case-${index}`,
        routingPass: index !== 0,
        estimatedCostMicroUsd: index === 19 ? 29_999 : 1_000,
      }),
    );

    expect(summarizeRoutingEval(cases, 'gpt-5.6-luna')).toMatchObject({
      cases: 20,
      routingAccuracy: 0.95,
      schemaValidity: 1,
      patchProposalValidity: 1,
      usageEvidenceValidity: 1,
      p95TurnCostMicroUsd: 1_000,
      categories: {
        patch: { cases: 20, passed: 19, accuracy: 0.95 },
      },
      thresholds: {
        routingAccuracy: true,
        schemaValidity: true,
        patchProposalValidity: true,
        usageEvidence: true,
        errorFree: true,
      },
    });
  });

  it('counts mixed-validity calls and patch proposals individually', () => {
    const cases = [
      result({
        observedTools: ['apply_json_patch', 'apply_json_patch'],
        toolCalls: [
          validCall('call-1'),
          { ...validCall('call-2'), schemaValid: false },
        ],
        schemaValid: false,
        patchProposalValid: false,
        patchProposalCount: 2,
        validPatchProposalCount: 1,
      }),
    ];

    expect(summarizeRoutingEval(cases, 'gpt-5.6-terra')).toMatchObject({
      schemaValidity: 0.5,
      patchProposalValidity: 0.5,
      p95TurnCostMicroUsd: null,
      thresholds: {
        schemaValidity: false,
        patchProposalValidity: false,
      },
    });
  });

  it('does not report cost evidence when any Luna case lacks usage', () => {
    const cases = [
      result(),
      result({
        id: 'missing-usage',
        usageEvidenceValid: false,
        usageRecords: 0,
        estimatedCostMicroUsd: null,
        error: 'missing_usage',
      }),
    ];

    expect(summarizeRoutingEval(cases, 'gpt-5.6-luna')).toMatchObject({
      usageEvidenceValidity: 0.5,
      p95TurnCostMicroUsd: null,
      thresholds: { usageEvidence: false, errorFree: false },
    });
  });
});

function result(
  overrides: Partial<RoutingEvalCaseResult> = {},
): RoutingEvalCaseResult {
  return {
    id: 'valid-patch',
    category: 'patch',
    expected: { decision: 'tool', tool: 'apply_json_patch' },
    observedTools: ['apply_json_patch'],
    toolCalls: [validCall('call-1')],
    responseText: '',
    routingPass: true,
    schemaValid: true,
    patchProposalValid: true,
    patchProposalCount: 1,
    validPatchProposalCount: 1,
    usageEvidenceValid: true,
    completedRounds: 1,
    usageRecords: 1,
    inputTokens: 100,
    outputTokens: 20,
    cachedInputTokens: 0,
    estimatedCostMicroUsd: 1_000,
    ...overrides,
  };
}

function validCall(callId: string) {
  return {
    callId,
    tool: 'apply_json_patch' as const,
    schemaValid: true,
  };
}
