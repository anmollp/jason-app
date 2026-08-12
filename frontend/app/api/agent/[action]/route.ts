import { NextRequest } from "next/server";
import { proxyAgentRequest } from "../agent-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  return proxyAgentRequest(request, action);
}
