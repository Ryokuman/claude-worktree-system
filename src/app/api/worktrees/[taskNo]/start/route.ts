import { NextResponse } from "next/server";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getActive, updateActive } from "@/lib/store";
import { findAvailablePort } from "@/lib/port-manager";

/**
 * POST /api/worktrees/:taskNo/start
 *
 * 워크트리의 개발 서버를 시작한다. (A8)
 * npm install (node_modules 없으면) → next dev -p {port} spawn
 *
 * Params: taskNo - 워크트리 식별자 (e.g. "DV-494", "TTN-1")
 *
 * Response 200: { status: "started", taskNo: string }
 * Response 500: { error: string }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> }
) {
  try {
    const { taskNo } = await params;
    const worktree = getActive().find((w) => w.taskNo === taskNo);
    if (!worktree) throw new Error(`Worktree ${taskNo} not found`);
    if (worktree.status === "running") throw new Error(`${taskNo} is already running`);

    // Assign port if not yet assigned
    if (!worktree.port) {
      const port = await findAvailablePort();
      updateActive(taskNo, { port });
      worktree.port = port;
    }

    // Install deps if node_modules missing
    const nodeModulesPath = path.join(worktree.path, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`[process] Installing dependencies for ${taskNo}...`);
      execSync("npm install", { cwd: worktree.path, stdio: "inherit" });
    }

    const child = spawn("npx", ["next", "dev", "-p", String(worktree.port)], {
      cwd: worktree.path,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PORT: String(worktree.port) },
    });

    child.unref();

    updateActive(taskNo, {
      status: "running",
      pid: child.pid || null,
    });

    console.log(`[process] Started dev server for ${taskNo} on port ${worktree.port} (PID: ${child.pid})`);
    return NextResponse.json({ status: "started", taskNo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
