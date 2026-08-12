import { NextRequest } from "next/server";
import {
  getBackendBaseUrl,
  getCloudRunIdentityToken,
} from "../backend-client";

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
