import { execSync } from "child_process";
import { readJson, writeJson } from "./store";
import type { ActiveWorktree } from "./types";

/** Find PID listening on a given port via lsof (macOS/Linux). Returns null if not found. */
function findPidByPort(port: number): number | null {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
    if (!output) return null;
    // lsof may return multiple PIDs (one per line), take the first
    const pid = parseInt(output.split("\n")[0], 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function stopDevServer(taskNo: string): void {
  const active = readJson<ActiveWorktree>("active.json");
  const worktree = active.find((w) => w.taskNo === taskNo);
  if (!worktree) throw new Error(`Worktree ${taskNo} not found`);

  let pid = worktree.pid;

  // Fallback: if PID is missing, try to find the process by port
  if (!pid && worktree.port) {
    pid = findPidByPort(worktree.port);
    if (!pid) {
      // No process found — just mark as stopped
      worktree.status = "stopped";
      worktree.pid = null;
      writeJson("active.json", active);
      console.log(`[process] No process found for ${taskNo}, marked as stopped`);
      return;
    }
    console.log(`[process] Found process for ${taskNo} via port ${worktree.port} (PID: ${pid})`);
  }

  if (!pid) throw new Error(`${taskNo} has no running process`);

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already dead
    }
  }

  worktree.status = "stopped";
  worktree.pid = null;
  writeJson("active.json", active);

  console.log(`[process] Stopped dev server for ${taskNo}`);
}
