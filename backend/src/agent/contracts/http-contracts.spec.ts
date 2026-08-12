import { parseAgentMessageRequest } from './http-contracts';

describe('agent HTTP contracts', () => {
  const valid = {
    sessionId: 's'.repeat(32),
    selectedTool: 'formatter',
    instruction: 'Format this JSON.',
    context: { input: '{}' },
    visibleMessages: [],
  };

  it('accepts strict, bounded tool context', () => {
    expect(parseAgentMessageRequest(valid)).toEqual(valid);
  });

  it('rejects extra fields, missing tool inputs, and oversized instructions', () => {
    expect(() =>
      parseAgentMessageRequest({ ...valid, secret: 'unexpected' }),
    ).toThrow('unexpected field');
    expect(() =>
      parseAgentMessageRequest({
        ...valid,
        selectedTool: 'diff',
        context: { before: '{}' },
      }),
    ).toThrow('context.after');
    expect(() =>
      parseAgentMessageRequest({ ...valid, instruction: 'x'.repeat(501) }),
    ).toThrow('instruction');
  });

  it('applies the 16 KiB AI context limit independently of deterministic tools', () => {
    expect(() =>
      parseAgentMessageRequest({
        ...valid,
        context: { input: JSON.stringify({ value: 'x'.repeat(17 * 1024) }) },
      }),
    ).toThrow('context.input');
  });

  it('does not echo untrusted content in validation errors', () => {
    const secret = 'private-json-value';
    let thrown: unknown;
    try {
      parseAgentMessageRequest({
        ...valid,
        context: { input: '{}', [secret]: secret },
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(secret);
  });
});
