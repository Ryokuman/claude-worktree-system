import { NextResponse } from "next/server";
import { getActive, removeActive, addEnded } from "@/lib/store";
import { stopDevServer } from "@/lib/process-manager";
import { archivePlan } from "@/lib/plan-manager";

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
  { params }: { params: Promise<{ taskNo: string }> }
) {
  try {
    const { taskNo } = await params;
    const worktree = getActive().find((w) => w.taskNo === taskNo);
    if (!worktree) {
      return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
    }

    // Stop server if running
    if (worktree.status === "running" && worktree.pid) {
      try {
        stopDevServer(taskNo);
      } catch {
        // Ignore stop errors
      }
    }

    // Remove from active
    removeActive(taskNo);

    // Archive plan
    archivePlan(worktree.branch);

    // Add to ended
    addEnded({
      taskNo: worktree.taskNo,
      taskName: worktree.taskName,
      branch: worktree.branch,
      completedAt: new Date().toISOString().split("T")[0],
    });

    return NextResponse.json({ status: "completed", taskNo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
