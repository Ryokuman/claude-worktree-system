import { NextResponse } from "next/server";
import { getActive, getDeactive, setDeactive, addActive } from "@/lib/store";
import { addWorktree } from "@/lib/git";
import { extractTaskNo, branchToTaskName } from "@/lib/task-utils";
import { findAvailablePort } from "@/lib/port-manager";
import { copyPlanToWorktree } from "@/lib/plan-manager";
import { env } from "@/lib/env";
import path from "path";
import fs from "fs";

/**
 * GET /api/worktrees
 *
 * 진행 중인 워크트리 목록을 반환한다.
 *
 * Response 200: ActiveWorktree[]
 */
export async function GET() {
  return NextResponse.json(getActive());
}

/**
 * POST /api/worktrees
 *
 * 새 워크트리를 생성한다. (A7)
 * 1. git worktree add 실행
 * 2. plan 파일을 워크트리로 복사
 * 3. 포트 자동 할당
 * 4. deactive에서 제거 → active에 추가
 *
 * Body: { branch: string }
 *
 * Response 201: ActiveWorktree
 * Response 400: { error: "branch is required" }
 * Response 409: { error: "Branch already active" }
 * Response 500: { error: string }
 */
export async function POST(request: Request) {
  try {
    const { branch } = await request.json();
    if (!branch) {
      return NextResponse.json({ error: "branch is required" }, { status: 400 });
    }

    // Check if already active
    const existing = getActive().find((w) => w.branch === branch);
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
    const deactive = getDeactive().filter((d) => d.branch !== branch);
    setDeactive(deactive);

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
    addActive(worktree);

    return NextResponse.json(worktree, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
