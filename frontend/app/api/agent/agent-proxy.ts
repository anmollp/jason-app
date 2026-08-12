import { NextRequest } from "next/server";
import {
  getBackendBaseUrl,
  getCloudRunIdentityToken,
} from "../backend-client";
import {
  isJsonContentType,
  isSameOriginRequest,
  selectTrustedClientIp,
} from "./agent-proxy-policy";

const MAX_AGENT_BODY_BYTES = 32 * 1024;
const allowedActions = new Set(["session", "message"]);

export async function proxyAgentRequest(
  request: NextRequest,
  action: string,
): Promise<Response> {
  if (!allowedActions.has(action)) {
    return Response.json(
      { message: "Unknown AskJason AI endpoint." },
      { status: 404 },
    );
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return Response.json(
      { message: "AskJason AI requests must use application/json." },
      { status: 415 },
    );
  }
  if (
    !isSameOriginRequest(
      request.headers.get("origin"),
      request.headers.get("x-forwarded-proto") ??
        request.nextUrl.protocol.slice(0, -1),
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    )
  ) {
    return Response.json(
      { message: "Cross-origin AI requests are not allowed." },
      { status: 403 },
    );
  }

  let body: ArrayBuffer;
  try {
    body = await readBoundedBody(request, MAX_AGENT_BODY_BYTES);
  } catch {
    return Response.json(
      { message: "The AskJason AI request exceeds 32 KiB." },
      { status: 413 },
    );
  }

  const apiBaseUrl = getBackendBaseUrl();
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-AskJason-Client-IP": selectTrustedClientIp(
      request.headers.get("x-forwarded-for"),
    ),
  });
  const visitorCookie = request.cookies.get("aj_visitor");
  if (visitorCookie) {
    headers.set("Cookie", `aj_visitor=${visitorCookie.value}`);
  }

  const identityToken = await getCloudRunIdentityToken(apiBaseUrl);
  if (identityToken) {
    headers.set("Authorization", `Bearer ${identityToken}`);
  }

  const upstream = await fetch(`${apiBaseUrl}/api/agent/${action}`, {
    body,
    cache: "no-store",
    headers,
    method: "POST",
    signal: request.signal,
  });
  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "Content-Type":
      upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
  });
  const setCookie = upstream.headers.get("Set-Cookie");
  if (setCookie) {
    responseHeaders.set("Set-Cookie", setCookie);
  }
  if (action === "message") {
    responseHeaders.set("X-Accel-Buffering", "no");
  }

  return new Response(upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
  });
}

async function readBoundedBody(
  request: NextRequest,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error("body_too_large");
  }
  if (!request.body) {
    return new ArrayBuffer(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel("body_too_large");
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer as ArrayBuffer;
}
