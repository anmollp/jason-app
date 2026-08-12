export function isJsonContentType(value: string | null): boolean {
  return value?.toLowerCase().startsWith("application/json") ?? false;
}

export function isSameOriginRequest(
  origin: string | null,
  proto: string,
  host: string | null,
): boolean {
  if (!origin || !host) {
    return false;
  }
  try {
    return new URL(origin).origin === `${proto}://${host}`;
  } catch {
    return false;
  }
}

export function selectTrustedClientIp(forwardedFor: string | null): string {
  const chain = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length >= 2) {
    return chain.at(-2) as string;
  }
  return chain.at(-1) ?? "0.0.0.0";
}
