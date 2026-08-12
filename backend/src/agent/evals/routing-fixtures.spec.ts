import {
  AGENT_RUNTIME_LIMITS,
  isAgentToolName,
} from '../contracts/tool-contracts';
import {
  ROUTING_FIXTURES,
  type RoutingFixtureCategory,
} from './routing-fixtures';

describe('initial routing eval fixtures', () => {
  const categories: RoutingFixtureCategory[] = [
    'formatter',
    'diff',
    'patch',
    'pointer',
    'ambiguous',
    'injection',
  ];

  it('contains twelve unique cases with two per category', () => {
    expect(ROUTING_FIXTURES).toHaveLength(12);
    expect(new Set(ROUTING_FIXTURES.map((fixture) => fixture.id)).size).toBe(
      12,
    );

    for (const category of categories) {
      expect(
        ROUTING_FIXTURES.filter((fixture) => fixture.category === category),
      ).toHaveLength(2);
    }
  });

  it('uses only approved tools and stays within contract fixture limits', () => {
    for (const fixture of ROUTING_FIXTURES) {
      expect(fixture.instruction.length).toBeLessThanOrEqual(
        AGENT_RUNTIME_LIMITS.instructionCharacters,
      );
      expect(
        Object.values(fixture.context).reduce(
          (bytes, value) => bytes + Buffer.byteLength(value),
          0,
        ),
      ).toBeLessThanOrEqual(AGENT_RUNTIME_LIMITS.untrustedContextBytes);

      if (fixture.expected.decision === 'tool') {
        expect(isAgentToolName(fixture.expected.tool)).toBe(true);
      }
    }
  });
});
