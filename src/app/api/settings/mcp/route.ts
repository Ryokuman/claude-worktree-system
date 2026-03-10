import { NextResponse } from "next/server";
import { readMcpConfig, writeMcpConfig } from "@/lib/mcp-config";
import type { McpConfig } from "@/lib/mcp-config";

/**
 * GET /api/settings/mcp
 */
export async function GET() {
  return NextResponse.json(readMcpConfig());
}

/**
 * PUT /api/settings/mcp
 * Body: McpConfig
 */
export async function PUT(request: Request) {
  try {
    const body: McpConfig = await request.json();

    if (!body.servers || typeof body.servers !== "object") {
      return NextResponse.json(
        { error: "servers must be an object" },
        { status: 400 },
      );
    }

    writeMcpConfig(body);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
