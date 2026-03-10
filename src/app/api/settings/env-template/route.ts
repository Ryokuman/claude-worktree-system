import { NextResponse } from "next/server";
import {
  readMainRepoEnv,
  readEnvTemplate,
  writeEnvTemplate,
} from "@/lib/env-generator";

const PLACEHOLDERS = ["{{PORT}}", "{{BRANCH}}", "{{TASK_NO}}", "{{WORKTREE_PATH}}"];

/**
 * GET /api/settings/env-template
 * Returns main repo .env keys + saved overrides
 */
export async function GET() {
  const mainEnv = readMainRepoEnv();
  const template = readEnvTemplate();

  if (!mainEnv) {
    return NextResponse.json({
      source: null,
      keys: [],
      overrides: {},
      placeholders: PLACEHOLDERS,
    });
  }

  return NextResponse.json({
    source: mainEnv.source,
    keys: mainEnv.entries,
    overrides: template.overrides,
    placeholders: PLACEHOLDERS,
  });
}

/**
 * PUT /api/settings/env-template
 * Body: { overrides: Record<string, string> }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { overrides } = body as { overrides: Record<string, string> };

    if (!overrides || typeof overrides !== "object") {
      return NextResponse.json(
        { error: "overrides must be an object" },
        { status: 400 },
      );
    }

    // Remove entries with empty values (no override)
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(overrides)) {
      const trimmed = value.trim();
      if (trimmed) {
        cleaned[key] = trimmed;
      }
    }

    const template = readEnvTemplate();
    template.overrides = cleaned;
    writeEnvTemplate(template);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
