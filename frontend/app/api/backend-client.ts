export function getBackendBaseUrl(): string {
  return (
    process.env.JASON_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function getCloudRunIdentityToken(
  audience: string,
): Promise<string | undefined> {
  if (!process.env.K_SERVICE) {
    return undefined;
  }

  const metadataHost =
    process.env.GCE_METADATA_HOST ?? "metadata.google.internal";
  const tokenAudience = process.env.JASON_API_AUDIENCE ?? audience;
  const tokenUrl = new URL(
    `http://${metadataHost}/computeMetadata/v1/instance/service-accounts/default/identity`,
  );
  tokenUrl.searchParams.set("audience", tokenAudience);

  const response = await fetch(tokenUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) {
    throw new Error("Unable to fetch Cloud Run identity token.");
  }
  return response.text();
}
