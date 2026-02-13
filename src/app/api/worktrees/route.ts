import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { addWorktree } from "@/lib/git";
import { extractTaskNo, branchToTaskName } from "@/lib/task-utils";
import { findAvailablePort } from "@/lib/port-manager";
import { copyPlanToWorktree } from "@/lib/plan-manager";
import { env } from "@/lib/env";
import path from "path";
import fs from "fs";

// GET /api/worktrees - List all active worktrees
export async function GET() {
  const active = store.getActive();
  return NextResponse.json(active);
}

// POST /api/worktrees - Create a new worktree (A7)
export async function POST(request: Request) {
  try {
    const { branch } = await request.json();
    if (!branch) {
      return NextResponse.json({ error: "branch is required" }, { status: 400 });
    }

    // Check if already active
    const existing = store.getActive().find((w) => w.branch === branch);
    if (existing) {
      return NextResponse.json({ error: "Branch already active" }, { status: 409 });
    }

    const taskNo = extractTaskNo(branch);
    const taskName = branchToTaskName(branch);
    const port = await findAvailablePort();
    const safeBranch = branch.replace(/\//g, "-");
    const worktreePath = path.join(env.WORKTREE_BASE_DIR, `${env.PROJECT_NAME}-${safeBranch}`);

    // Create git worktree if path doesn't exist
    if (!fs.existsSync(worktreePath)) {
      addWorktree(branch, worktreePath);
    }

    // Copy plan files to worktree
    copyPlanToWorktree(branch, worktreePath);

    // Remove from deactive
    const deactive = store.getDeactive().filter((d) => d.branch !== branch);
    store.setDeactive(deactive);

    // Add to active
    const worktree = {
      taskNo,
      taskName,
      branch,
      path: worktreePath,
      port,
      status: "stopped" as const,
      pid: null,
      createdAt: new Date().toISOString().split("T")[0],
    };
    store.addActive(worktree);

    return NextResponse.json(worktree, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
