const SYSTEMIC_PROVIDER_ERRORS = new Set([
  'TimeoutError',
  'authentication_error',
  'billing_hard_limit_reached',
  'insufficient_quota',
  'invalid_api_key',
  'organization_spend_limit_exceeded',
  'permission_denied',
  'project_spend_limit_exceeded',
  'rate_limit_exceeded',
  'server_error',
  'usage_limit_reached',
]);

export function isSystemicProviderError(error: string): boolean {
  return (
    SYSTEMIC_PROVIDER_ERRORS.has(error) ||
    /^http_(401|403|429|5\d\d)$/.test(error)
  );
}
