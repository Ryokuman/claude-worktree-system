import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { stopDevServer } from "@/lib/process-manager";
import { archivePlan } from "@/lib/plan-manager";

// POST /api/worktrees/[taskNo]/complete (A13)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> }
) {
  try {
    const { taskNo } = await params;
    const worktree = store.getActive().find((w) => w.taskNo === taskNo);
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
    store.removeActive(taskNo);

    // Archive plan
    archivePlan(worktree.branch);

    // Add to ended
    store.addEnded({
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
