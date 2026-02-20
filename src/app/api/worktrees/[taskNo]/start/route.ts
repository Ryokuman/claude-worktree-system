import { NextResponse } from "next/server";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { readJson, writeJson } from "@/lib/store";
import { ensureLogDir, getLogPath } from "@/lib/log-manager";
import { readWorktreeEnv } from "@/lib/env-generator";
import { withTaskLock } from "@/lib/task-lock";
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
 * 워크트리의 개발 서버를 시작한다. (A8)
 * npm install (node_modules 없으면) → npm run dev spawn
 * PORT는 워크트리 .env 파일에서 읽어 active.json에 반영
 *
 * Params: taskNo - 워크트리 식별자 (e.g. "DV-494", "TTN-1")
 *
 * Response 200: { status: "started", taskNo: string }
 * Response 500: { error: string }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  const { taskNo } = await params;

  try {
    return await withTaskLock(taskNo, async () => {
      // Re-read inside lock to get latest state
      const active = readJson<ActiveWorktree>("active.json");
      const worktree = active.find((w) => w.taskNo === taskNo);
      if (!worktree) throw new Error(`Worktree ${taskNo} not found`);
      if (worktree.status === "running")
        throw new Error(`${taskNo} is already running`);

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
        worktree.status = "running";
        worktree.pid = existingPid;
        writeJson("active.json", active);
        return NextResponse.json({ status: "started", taskNo });
      }

      // Install deps if node_modules missing (async to avoid blocking event loop)
      const nodeModulesPath = path.join(worktree.path, "node_modules");
      if (!fs.existsSync(nodeModulesPath)) {
        console.log(`[process] Installing dependencies for ${taskNo}...`);
        worktree.status = "installing";
        writeJson("active.json", active);

        const install = spawn("npm", ["install"], { cwd: worktree.path, stdio: "ignore" });
        await new Promise<void>((resolve, reject) => {
          install.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`npm install exited with code ${code}`));
          });
          install.on("error", reject);
        });
        console.log(`[process] Dependencies installed for ${taskNo}`);
      }

      // Redirect stdout/stderr to log file via file descriptor
      ensureLogDir();
      const logFd = fs.openSync(getLogPath(taskNo), "a");

      // Build env: system vars + worktree .env (worktree values override handler's)
      const worktreeEnv: Record<string, string> = {};
      if (envEntries) {
        for (const e of envEntries) {
          worktreeEnv[e.key] = e.value;
        }
      }

      const child = spawn("npm", ["run", "dev"], {
        cwd: worktree.path,
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: { ...process.env, ...worktreeEnv },
      });

      child.unref();
      fs.closeSync(logFd);

      worktree.status = "running";
      worktree.pid = child.pid || null;
      worktree.startedAt = new Date().toISOString();
      writeJson("active.json", active);

      console.log(
        `[process] Started dev server for ${taskNo} on port ${worktree.port} (PID: ${child.pid})`,
      );
      return NextResponse.json({ status: "started", taskNo });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
