import { AgentError } from '../agent.errors';
import { AgentToolValidator } from '../agent-tool-validator.service';
import {
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
} from './tool-contracts';

describe('agent tool contracts', () => {
  const validator = new AgentToolValidator();

  it('publishes exactly four strict, canonical tool schemas', () => {
    expect(AGENT_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual(
      AGENT_TOOL_NAMES,
    );

    for (const tool of AGENT_TOOL_DEFINITIONS) {
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(tool.resultSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
    }
  });

  it.each([
    ['format_json', { input: '{"ok":true}' }],
    ['diff_json', { before: '{"a":1}', after: '{"a":2}' }],
    [
      'apply_json_patch',
      {
        document: '{"a":1}',
        patch: '[{"op":"replace","path":"/a","value":2}]',
      },
    ],
    ['resolve_json_pointer', { document: '{"a":1}', path: '' }],
  ] as const)('accepts valid %s arguments', (tool, input) => {
    expect(validator.validateArguments(tool, JSON.stringify(input))).toEqual(
      input,
    );
  });

  it('rejects malformed, unknown, and extra arguments without echoing input', () => {
    const secret = 'do-not-echo-this';

    expect(() =>
      validator.validateArguments('format_json', `{${secret}`),
    ).toThrow(
      new AgentError(
        'INVALID_TOOL_ARGUMENTS',
        'The provider returned malformed tool arguments.',
      ),
    );

    expect(() =>
      validator.validateArguments(
        'format_json',
        JSON.stringify({ input: '{}', extra: secret }),
      ),
    ).toThrow('do not match the approved schema');

    try {
      validator.validateArguments(
        'format_json',
        JSON.stringify({ input: '{}', extra: secret }),
      );
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('enforces the 16 KiB AI cap using combined UTF-8 bytes', () => {
    const oversizedMultibyteContext = '😀'.repeat(
      AGENT_RUNTIME_LIMITS.untrustedContextBytes / 4,
    );

    expect(() =>
      validator.validateArguments(
        'diff_json',
        JSON.stringify({ before: oversizedMultibyteContext, after: '{}' }),
      ),
    ).toThrow('exceeds the 16 KiB UTF-8 limit');
  });

  it('validates deterministic result envelopes', () => {
    expect(() =>
      validator.validateResult('format_json', { output: '{\n  "ok": true\n}' }),
    ).not.toThrow();

    expect(() =>
      validator.validateResult('format_json', { output: 42 } as never),
    ).toThrow('unexpected result shape');
  });
});
