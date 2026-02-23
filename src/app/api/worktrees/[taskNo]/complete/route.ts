import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { readJson, writeJson } from "@/lib/store";
import { stopDevServer } from "@/lib/process-manager";
import { getServerStatus } from "@/lib/pty-manager";
import { env } from "@/lib/env";
import type { ActiveWorktree, EndedWorktree } from "@/lib/types";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

/**
 * POST /api/worktrees/:taskNo/complete
 *
 * 워크트리 작업을 완료 처리한다. (A13)
 * 1. running이면 서버 중지
 * 2. active에서 제거 → ended에 추가
 * 3. plan/active/{branch}/ → plan/ended/{branch}/ 아카이브
 *
 * Params: taskNo - 워크트리 식별자
 *
 * Response 200: { status: "completed", taskNo: string }
 * Response 404: { error: "Worktree not found" }
 * Response 500: { error: string }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  try {
    const { taskNo } = await params;
    const active = readJson<ActiveWorktree>("active.json");
    const idx = active.findIndex((w) => w.taskNo === taskNo);
    if (idx === -1) {
      return NextResponse.json(
        { error: "Worktree not found" },
        { status: 404 },
      );
    }
    const worktree = active[idx];

    // Stop server if running or starting (check PTY state, not stored status)
    const serverStatus = getServerStatus(taskNo);
    if (serverStatus !== "stopped") {
      try {
        stopDevServer(taskNo);
      } catch {
        // Ignore stop errors
      }
    }

    // Remove from active
    active.splice(idx, 1);
    writeJson("active.json", active);

    // Archive plan: plan/active/{branch} → plan/ended/{branch}
    const activeDir = path.join(PLAN_DIR, "active", worktree.branch);
    const endedDir = path.join(PLAN_DIR, "ended", worktree.branch);
    if (fs.existsSync(activeDir)) {
      if (!fs.existsSync(endedDir)) fs.mkdirSync(endedDir, { recursive: true });
      const files = fs.readdirSync(activeDir).filter((f) => !f.startsWith("."));
      for (const file of files) {
        fs.copyFileSync(path.join(activeDir, file), path.join(endedDir, file));
      }
      fs.rmSync(activeDir, { recursive: true, force: true });
    }

    // Add to ended
    const ended = readJson<EndedWorktree>("ended.json");
    ended.push({
      taskNo: worktree.taskNo,
      taskName: worktree.taskName,
      branch: worktree.branch,
      completedAt: new Date().toISOString().split("T")[0],
    });
    writeJson("ended.json", ended);

    // Remove git worktree (디스크에서 삭제 → classifier 재등록 방지)
    try {
      execSync(`git worktree remove "${worktree.path}" --force`, {
        cwd: env.MAIN_REPO_PATH,
        encoding: "utf-8",
        stdio: "ignore",
      });
      console.log(`[complete] Removed git worktree: ${worktree.path}`);
    } catch (e) {
      console.warn(`[complete] Failed to remove git worktree: ${e}`);
    }

    return NextResponse.json({ status: "completed", taskNo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
