import { isSystemicProviderError } from './routing-eval-policy';

describe('isSystemicProviderError', () => {
  it.each([
    'TimeoutError',
    'server_error',
    'http_500',
    'http_503',
    'http_429',
    'insufficient_quota',
  ])('stops a paid run for %s', (error) => {
    expect(isSystemicProviderError(error)).toBe(true);
  });

  it('does not abort the matrix for a case-specific output limit', () => {
    expect(isSystemicProviderError('output_limit')).toBe(false);
  });
});
