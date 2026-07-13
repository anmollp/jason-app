import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "jason-web",
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
