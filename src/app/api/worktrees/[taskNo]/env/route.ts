import { NextResponse } from "next/server";
import { readJson } from "@/lib/store";
import {
  readWorktreeEnv,
  writeWorktreeEnv,
  readMainRepoEnv,
  readEnvTemplate,
  generateEnv,
  parseEnv,
  serializeEnv,
  type EnvEntry,
} from "@/lib/env-generator";
import type { ActiveWorktree } from "@/lib/types";

function findWorktree(taskNo: string): ActiveWorktree | undefined {
  return readJson<ActiveWorktree>("active.json").find((w) => w.taskNo === taskNo);
}

/**
 * GET /api/worktrees/:taskNo/env
 *
 * 워크트리의 .env 파일 내용을 반환한다.
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

  const entries = readWorktreeEnv(worktree.path);
  return NextResponse.json({ entries, exists: entries !== null });
}

/**
 * PUT /api/worktrees/:taskNo/env
 *
 * 워크트리의 .env 파일을 수정한다.
 *
 * Body: { entries: EnvEntry[] } or { raw: string }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  try {
    const { taskNo } = await params;
    const worktree = findWorktree(taskNo);
    if (!worktree) {
      return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
    }

    const body = await request.json();

    // Apply template mode
    if (body.applyTemplate) {
      const mainEnv = readMainRepoEnv();
      if (!mainEnv) {
        return NextResponse.json({ error: "Main repo .env not found" }, { status: 404 });
      }
      const template = readEnvTemplate();
      const vars = {
        PORT: String(worktree.port),
        BRANCH: worktree.branch,
        TASK_NO: worktree.taskNo,
        WORKTREE_PATH: worktree.path,
      };
      const generated = generateEnv(mainEnv.entries, template.overrides, vars);
      writeWorktreeEnv(worktree.path, generated);
      return NextResponse.json({ ok: true, entries: generated });
    }

    if (body.raw !== undefined) {
      // Raw string mode
      const entries = parseEnv(body.raw);
      writeWorktreeEnv(worktree.path, entries);
      return NextResponse.json({ ok: true, entries });
    }

    if (body.entries) {
      writeWorktreeEnv(worktree.path, body.entries as EnvEntry[]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "entries or raw is required" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
