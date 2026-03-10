import { NextResponse } from "next/server";
import {
  readAutoFeedbackConfig,
  writeAutoFeedbackConfig,
} from "@/lib/auto-feedback";
import type { AutoFeedbackConfig } from "@/lib/auto-feedback";

/**
 * GET /api/settings/auto-feedback
 */
export async function GET() {
  return NextResponse.json(readAutoFeedbackConfig());
}

/**
 * PUT /api/settings/auto-feedback
 * Body: AutoFeedbackConfig
 */
export async function PUT(request: Request) {
  try {
    const body: AutoFeedbackConfig = await request.json();

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      );
    }
    if (typeof body.prompt !== "string") {
      return NextResponse.json(
        { error: "prompt must be a string" },
        { status: 400 },
      );
    }

    writeAutoFeedbackConfig(body);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
