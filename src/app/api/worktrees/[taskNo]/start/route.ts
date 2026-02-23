import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { readJson, writeJson } from "@/lib/store";
import { readWorktreeEnv } from "@/lib/env-generator";
import { withTaskLock } from "@/lib/task-lock";
import {
  createSession,
  getServerSession,
  getServerStatus,
  destroySession,
} from "@/lib/pty-manager";
import type { ActiveWorktree } from "@/lib/types";

/** Find PID listening on a given port via lsof. Returns null if not found. */
function findPidByPort(port: number): number | null {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
    if (!output) return null;
    const pid = parseInt(output.split("\n")[0], 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * POST /api/worktrees/:taskNo/start
 *
 * 워크트리의 개발 서버를 시작한다.
 * PTY 세션을 생성하고 npm run dev를 실행.
 * starting/running 상태에서는 중복 시작 방지.
 *
 * Params: taskNo - 워크트리 식별자 (e.g. "DV-494", "TTN-1")
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  const { taskNo } = await params;

  try {
    return await withTaskLock(taskNo, async () => {
      const active = readJson<ActiveWorktree>("active.json");
      const worktree = active.find((w) => w.taskNo === taskNo);
      if (!worktree) throw new Error(`Worktree ${taskNo} not found`);

      // Check PTY state (source of truth) instead of active.json status
      const currentStatus = getServerStatus(taskNo);
      if (currentStatus === "running") {
        throw new Error(`${taskNo} is already running`);
      }
      if (currentStatus === "starting") {
        throw new Error(`${taskNo} is already starting`);
      }

      // Read PORT from worktree's .env file
      const envEntries = readWorktreeEnv(worktree.path);
      const portEntry = envEntries?.find((e) => e.key === "PORT");
      if (portEntry) {
        const envPort = parseInt(portEntry.value, 10);
        if (!Number.isNaN(envPort) && envPort !== worktree.port) {
          worktree.port = envPort;
          writeJson("active.json", active);
        }
      }

      if (!worktree.port) {
        throw new Error(`${taskNo}: PORT not found in .env`);
      }

      // Check if a process is already running on this port (orphaned process recovery)
      const existingPid = findPidByPort(worktree.port);
      if (existingPid) {
        console.log(`[process] Found existing process on port ${worktree.port} (PID: ${existingPid}), recovering for ${taskNo}`);
        worktree.pid = existingPid;
        writeJson("active.json", active);
        return NextResponse.json({ status: "started", taskNo });
      }

      // Destroy any leftover dead PTY session
      const existingSession = getServerSession(taskNo);
      if (existingSession) {
        destroySession(`server-${taskNo}`);
      }

      // Determine command: install deps if needed, then start dev server
      const nodeModulesPath = path.join(worktree.path, "node_modules");
      const needsInstall = !fs.existsSync(nodeModulesPath);
      const command = needsInstall
        ? "npm install && npm run dev"
        : "npm run dev";

      if (needsInstall) {
        console.log(`[process] Will install dependencies for ${taskNo}...`);
      }

      // Create PTY session with clean shell environment
      // No process.env spread → prevents __NEXT_PRIVATE_* contamination
      // Status is derived from PTY state: "starting" until HTTP health check responds
      const session = await createSession({
        sessionId: `server-${taskNo}`,
        cwd: worktree.path,
        type: "server",
        taskNo,
        initialCommand: command,
      });

      // Store PID and startedAt in active.json (terminal info only)
      worktree.pid = session.pty.pid;
      worktree.startedAt = new Date().toISOString();
      writeJson("active.json", active);

      console.log(
        `[process] Started dev server for ${taskNo} on port ${worktree.port} (PID: ${session.pty.pid})`,
      );
      return NextResponse.json({ status: "started", taskNo });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
