const LUNA_MICRO_USD_PER_TOKEN = {
  input: 0.2,
  cachedInput: 0.02,
  output: 1.2,
} as const;

export function estimateLunaCostMicroUsd(usage: {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}): number {
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const uncached = Math.max(usage.inputTokens - cached, 0);
  return Math.ceil(
    uncached * LUNA_MICRO_USD_PER_TOKEN.input +
      cached * LUNA_MICRO_USD_PER_TOKEN.cachedInput +
      usage.outputTokens * LUNA_MICRO_USD_PER_TOKEN.output,
  );
}
