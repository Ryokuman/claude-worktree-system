import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { readJson, writeJson } from "@/lib/store";
import { extractTaskNo, branchToTaskName } from "@/lib/task-utils";
import { findAvailablePort } from "@/lib/port-manager";
import { env } from "@/lib/env";
import {
  readMainRepoEnv,
  readEnvTemplate,
  generateEnv,
  writeWorktreeEnv,
} from "@/lib/env-generator";
import type { ActiveWorktree, DeactiveBranch } from "@/lib/types";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

/**
 * GET /api/worktrees
 *
 * 진행 중인 워크트리 목록을 반환한다.
 *
 * Response 200: ActiveWorktree[]
 */
export async function GET() {
  return NextResponse.json(readJson<ActiveWorktree>("active.json"));
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
    const { branch, healthCheckPath } = await request.json();
    if (!branch) {
      return NextResponse.json(
        { error: "branch is required" },
        { status: 400 },
      );
    }

    const active = readJson<ActiveWorktree>("active.json");
    if (active.find((w) => w.branch === branch)) {
      return NextResponse.json(
        { error: "Branch already active" },
        { status: 409 },
      );
    }

    const taskNo = extractTaskNo(branch);
    const taskName = branchToTaskName(branch);
    const port = await findAvailablePort();
    const safeBranch = branch.replace(/\//g, "-");
    const worktreePath = path.join(
      env.WORKTREE_BASE_DIR,
      `${env.PROJECT_NAME}-${safeBranch}`,
    );

    // Create git worktree if path doesn't exist
    if (!fs.existsSync(worktreePath)) {
      execSync(`git worktree add "${worktreePath}" "${branch}"`, {
        cwd: env.MAIN_REPO_PATH,
        encoding: "utf-8",
      });
    }

    // Copy plan files to worktree
    const planDir = path.join(PLAN_DIR, "active", branch);
    if (fs.existsSync(planDir)) {
      const targetDir = path.join(worktreePath, "plan");
      if (!fs.existsSync(targetDir))
        fs.mkdirSync(targetDir, { recursive: true });
      const planFiles = fs
        .readdirSync(planDir)
        .filter((f) => !f.startsWith("."));
      for (const file of planFiles) {
        fs.copyFileSync(path.join(planDir, file), path.join(targetDir, file));
      }
    }

    // Auto-generate .env for worktree
    const mainEnv = readMainRepoEnv();
    if (mainEnv) {
      const template = readEnvTemplate();
      const vars = {
        PORT: String(port),
        BRANCH: branch,
        TASK_NO: taskNo,
        WORKTREE_PATH: worktreePath,
      };
      const entries = generateEnv(mainEnv.entries, template.overrides, vars);
      writeWorktreeEnv(worktreePath, entries);
    }

    // Remove from deactive
    const deactive = readJson<DeactiveBranch>("deactive.json").filter(
      (d) => d.branch !== branch,
    );
    writeJson("deactive.json", deactive);

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
      healthCheckPath: healthCheckPath || undefined,
    };
    active.push(worktree);
    writeJson("active.json", active);

    return NextResponse.json(worktree, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
