import { OpenAiInstructionModerator } from './instruction-moderator';

describe('OpenAiInstructionModerator', () => {
  it('sends only the natural-language instruction to moderation', async () => {
    const moderate = jest.fn().mockResolvedValue(false);
    const moderator = new OpenAiInstructionModerator({ moderate });
    const signal = new AbortController().signal;

    await moderator.assertAllowed('Explain this formatting error.', signal);

    expect(moderate).toHaveBeenCalledWith(
      'Explain this formatting error.',
      signal,
    );
  });

  it('fails closed for flagged, malformed, and unavailable moderation', async () => {
    const cases: Array<{
      response?: unknown;
      rejection?: Error;
      code: string;
    }> = [
      {
        response: { results: [{ flagged: true }] },
        code: 'MODERATION_BLOCKED',
      },
      { response: { results: [] }, code: 'MODERATION_UNAVAILABLE' },
      {
        rejection: new Error('upstream secret'),
        code: 'MODERATION_UNAVAILABLE',
      },
    ];

    for (const item of cases) {
      const moderate = item.rejection
        ? jest.fn().mockRejectedValue(item.rejection)
        : jest
            .fn()
            .mockResolvedValue(
              (item.response as { results: Array<{ flagged: boolean }> })
                .results[0]?.flagged,
            );
      const moderator = new OpenAiInstructionModerator({
        moderate,
      });
      await expect(
        moderator.assertAllowed('instruction', new AbortController().signal),
      ).rejects.toMatchObject({ code: item.code });
    }
  });
});
