import { execSync } from "child_process";
import { readJson, writeJson } from "./store";
import { getServerSession, destroyServerSession } from "./pty-manager";
import type { ActiveWorktree } from "./types";

/** Find PID listening on a given port via lsof (macOS/Linux). Returns null if not found. */
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
 * Stop a dev server for a worktree.
 * Status is derived from PTY state — no need to write status to active.json.
 * Destroying the PTY session → getServerStatus returns "stopped" automatically.
 */
export function stopDevServer(taskNo: string): void {
  const active = readJson<ActiveWorktree>("active.json");
  const worktree = active.find((w) => w.taskNo === taskNo);
  if (!worktree) throw new Error(`Worktree ${taskNo} not found`);

  // 1. Try PTY session destruction first
  const session = getServerSession(taskNo);
  if (session) {
    destroyServerSession(taskNo);
    console.log(`[process] Stopped dev server for ${taskNo} via PTY session`);
    // Clear PID in active.json (terminal info cleanup)
    worktree.pid = null;
    writeJson("active.json", active);
    return;
  }

  // 2. Fallback: port-based kill (orphaned processes without PTY session)
  let pid = worktree.pid;

  if (!pid && worktree.port) {
    pid = findPidByPort(worktree.port);
    if (!pid) {
      worktree.pid = null;
      writeJson("active.json", active);
      console.log(`[process] No process found for ${taskNo}`);
      return;
    }
    console.log(`[process] Found process for ${taskNo} via port ${worktree.port} (PID: ${pid})`);
  }

  if (!pid) throw new Error(`${taskNo} has no running process`);

  // Kill all processes on this port
  if (worktree.port) {
    try {
      execSync(`lsof -ti :${worktree.port} | xargs kill -SIGTERM`, {
        encoding: "utf-8",
        stdio: "ignore",
      });
    } catch {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }
  } else {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }

  worktree.pid = null;
  writeJson("active.json", active);

  console.log(`[process] Stopped dev server for ${taskNo}`);
}
