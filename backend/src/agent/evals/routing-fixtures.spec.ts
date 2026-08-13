import { parseAgentMessageRequest } from '../contracts/http-contracts';
import {
  AGENT_RUNTIME_LIMITS,
  isAgentToolName,
} from '../contracts/tool-contracts';
import {
  ROUTING_FIXTURES,
  type RoutingFixtureCategory,
} from './routing-fixtures';

describe('release routing eval fixtures', () => {
  const categories: RoutingFixtureCategory[] = [
    'formatter',
    'diff',
    'patch',
    'pointer',
    'ambiguous',
    'injection',
  ];

  it('contains sixty unique cases with ten per approved category', () => {
    expect(ROUTING_FIXTURES).toHaveLength(60);
    expect(new Set(ROUTING_FIXTURES.map((fixture) => fixture.id)).size).toBe(
      60,
    );

    for (const category of categories) {
      expect(
        ROUTING_FIXTURES.filter((fixture) => fixture.category === category),
      ).toHaveLength(10);
    }
  });

  it('passes the production request parser and uses only approved tools', () => {
    for (const fixture of ROUTING_FIXTURES) {
      expect(() =>
        parseAgentMessageRequest({
          sessionId: `eval-${fixture.id}`,
          selectedTool: fixture.selectedTool,
          instruction: fixture.instruction,
          context: fixture.context,
          visibleMessages: [],
        }),
      ).not.toThrow();
      expect(fixture.instruction.length).toBeLessThanOrEqual(
        AGENT_RUNTIME_LIMITS.instructionCharacters,
      );

      if (fixture.expected.decision === 'tool') {
        expect(isAgentToolName(fixture.expected.tool)).toBe(true);
      }
    }
  });

  it('preserves the approved routing and adversarial decision distribution', () => {
    const expectedTools = {
      formatter: 'format_json',
      diff: 'diff_json',
      patch: 'apply_json_patch',
      pointer: 'resolve_json_pointer',
    } as const;

    for (const [category, expectedTool] of Object.entries(expectedTools)) {
      const fixtures = ROUTING_FIXTURES.filter(
        (fixture) => fixture.category === category,
      );
      expect(
        fixtures.every(
          (fixture) =>
            fixture.expected.decision === 'tool' &&
            fixture.expected.tool === expectedTool,
        ),
      ).toBe(true);
    }

    const ambiguous = ROUTING_FIXTURES.filter(
      (fixture) => fixture.category === 'ambiguous',
    );
    expect(
      ambiguous.every((fixture) => fixture.expected.decision === 'clarify'),
    ).toBe(true);

    const injection = ROUTING_FIXTURES.filter(
      (fixture) => fixture.category === 'injection',
    );
    expect(
      injection.filter((fixture) => fixture.expected.decision === 'tool'),
    ).toHaveLength(5);
    expect(
      injection.filter((fixture) => fixture.expected.decision === 'refuse'),
    ).toHaveLength(5);
  });
});
