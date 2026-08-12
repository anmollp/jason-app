import type { AppService } from '../app.service';
import { AgentToolExecutor } from './agent-tool-executor.service';
import { AgentToolValidator } from './agent-tool-validator.service';

describe('AgentToolExecutor', () => {
  const appService = {
    formatJson: jest.fn().mockResolvedValue({ output: '{\n  "a": 1\n}' }),
    diffJson: jest.fn().mockResolvedValue({
      operations: [{ op: 'replace', path: '/a', value: 2 }],
      summary: { changes: 1, added: 0, removed: 0, replaced: 1 },
    }),
    patchJson: jest.fn().mockResolvedValue({
      output: '{"a":2}',
      summary: { operations: 1, added: 0, removed: 0, replaced: 1 },
    }),
    pointerJson: jest.fn().mockResolvedValue({
      output: '1',
      summary: { depth: 1, found: true, issues: 0, kind: 'number', path: '/a' },
    }),
  } as unknown as jest.Mocked<AppService>;
  const executor = new AgentToolExecutor(appService, new AgentToolValidator());

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['format_json', { input: '{"a":1}' }, 'formatJson', ['{"a":1}']],
    [
      'diff_json',
      { before: '{"a":1}', after: '{"a":2}' },
      'diffJson',
      ['{"a":1}', '{"a":2}'],
    ],
    [
      'apply_json_patch',
      {
        document: '{"a":1}',
        patch: '[{"op":"replace","path":"/a","value":2}]',
      },
      'patchJson',
      ['{"a":1}', '[{"op":"replace","path":"/a","value":2}]'],
    ],
    [
      'resolve_json_pointer',
      { document: '{"a":1}', path: '/a' },
      'pointerJson',
      ['{"a":1}', '/a'],
    ],
  ] as const)(
    'maps %s to AppService.%s',
    async (tool, args, method, expected) => {
      const result = await executor.execute({
        callId: `call-${tool}`,
        tool,
        argumentsJson: JSON.stringify(args),
      });

      expect(appService[method]).toHaveBeenCalledWith(...expected);
      expect(result).toMatchObject({
        ok: true,
        tool,
        validation: { engine: 'jason', valid: true },
      });
    },
  );

  it('normalizes tool failures without leaking raw Rust input or errors', async () => {
    const secret = 'customer-secret-json';
    appService.formatJson.mockRejectedValueOnce(
      new Error(`expected JSON near ${secret}`),
    );

    const result = await executor.execute({
      callId: 'call-failed',
      tool: 'format_json',
      argumentsJson: JSON.stringify({ input: `{"value":"${secret}"}` }),
    });

    expect(result).toEqual({
      ok: false,
      tool: 'format_json',
      callId: 'call-failed',
      error: {
        code: 'INVALID_JSON',
        message: 'The deterministic Jason tool rejected invalid JSON input.',
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
