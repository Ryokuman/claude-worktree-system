import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readJson } from "@/lib/store";
import {
  readMainRepoEnv,
  readEnvTemplate,
  generateEnv,
  writeWorktreeEnv,
} from "@/lib/env-generator";
import { readMcpConfig, applyMcpToWorktree } from "@/lib/mcp-config";
import type { ActiveWorktree } from "@/lib/types";

function findWorktree(taskNo: string): ActiveWorktree | undefined {
  return readJson<ActiveWorktree>("active.json").find(
    (w) => w.taskNo === taskNo,
  );
}

/**
 * GET /api/worktrees/:taskNo/apply-template
 *
 * Check which template files exist in the worktree.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  const { taskNo } = await params;
  const worktree = findWorktree(taskNo);
  if (!worktree) {
    return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
  }

  const envExists = fs.existsSync(path.join(worktree.path, ".env"));
  const mcpExists = fs.existsSync(path.join(worktree.path, ".mcp.json"));

  const mcpConfig = readMcpConfig();
  const mcpHasEnabled = Object.values(mcpConfig.servers).some((s) => s.enabled);

  return NextResponse.json({
    env: { exists: envExists },
    mcp: { exists: mcpExists, hasEnabled: mcpHasEnabled },
  });
}

/**
 * POST /api/worktrees/:taskNo/apply-template
 *
 * Apply selected templates to the worktree.
 * Body: { env?: boolean, mcp?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  try {
    const { taskNo } = await params;
    const worktree = findWorktree(taskNo);
    if (!worktree) {
      return NextResponse.json(
        { error: "Worktree not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const results: Record<string, boolean> = {};

    // Apply env template
    if (body.env) {
      const mainEnv = readMainRepoEnv();
      if (mainEnv) {
        const template = readEnvTemplate();
        const vars = {
          PORT: String(worktree.port),
          BRANCH: worktree.branch,
          TASK_NO: worktree.taskNo,
          WORKTREE_PATH: worktree.path,
        };
        const generated = generateEnv(mainEnv.entries, template.overrides, vars);
        writeWorktreeEnv(worktree.path, generated);
        results.env = true;
      } else {
        results.env = false;
      }
    }

    // Apply MCP template
    if (body.mcp) {
      const mcpConfig = readMcpConfig();
      applyMcpToWorktree(worktree.path, mcpConfig, worktree.port);
      results.mcp = true;
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
