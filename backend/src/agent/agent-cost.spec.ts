import { estimateLunaCostMicroUsd } from './agent-cost';

describe('estimateLunaCostMicroUsd', () => {
  it('uses the verified Luna input, cached-input, and output rates', () => {
    expect(
      estimateLunaCostMicroUsd({
        inputTokens: 1_000,
        cachedInputTokens: 200,
        outputTokens: 100,
      }),
    ).toBe(284);
  });

  it('never bills cached tokens twice or above total input', () => {
    expect(
      estimateLunaCostMicroUsd({
        inputTokens: 100,
        cachedInputTokens: 200,
        outputTokens: 0,
      }),
    ).toBe(2);
  });
});
