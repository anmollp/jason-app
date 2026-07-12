import { NextRequest } from "next/server";

const allowedTools = new Set(["format", "diff", "patch", "pointer"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;

  if (!allowedTools.has(tool)) {
    return Response.json({ message: "Unknown Jason tool." }, { status: 404 });
  }

  const apiBaseUrl = getBackendBaseUrl();
  const body = await request.text();
  const headers = new Headers({
    "Content-Type": request.headers.get("Content-Type") ?? "application/json",
  });
  const identityToken = await getCloudRunIdentityToken(apiBaseUrl);

  if (identityToken) {
    headers.set("Authorization", `Bearer ${identityToken}`);
  }

  const response = await fetch(`${apiBaseUrl}/${tool}`, {
    body,
    headers,
    method: "POST",
  });

  return new Response(response.body, {
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/json",
    },
    status: response.status,
  });
}

function getBackendBaseUrl() {
  return (
    process.env.JASON_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function getCloudRunIdentityToken(audience: string) {
  if (!process.env.K_SERVICE) {
    return undefined;
  }

  const metadataHost = process.env.GCE_METADATA_HOST ?? "metadata.google.internal";
  const tokenAudience = process.env.JASON_API_AUDIENCE ?? audience;
  const tokenUrl = new URL(
    `http://${metadataHost}/computeMetadata/v1/instance/service-accounts/default/identity`,
  );

  tokenUrl.searchParams.set("audience", tokenAudience);

  const response = await fetch(tokenUrl, {
    headers: {
      "Metadata-Flavor": "Google",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch Cloud Run identity token.");
  }

  return response.text();
}
