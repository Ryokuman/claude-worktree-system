import { readJson, writeJson } from "./store";
import type { ActiveWorktree } from "./types";

export function stopDevServer(taskNo: string): void {
  const active = readJson<ActiveWorktree>("active.json");
  const worktree = active.find((w) => w.taskNo === taskNo);
  if (!worktree) throw new Error(`Worktree ${taskNo} not found`);
  if (!worktree.pid) throw new Error(`${taskNo} has no running process`);

  try {
    process.kill(-worktree.pid, "SIGTERM");
  } catch {
    try {
      process.kill(worktree.pid, "SIGTERM");
    } catch {
      // Process already dead
    }
  }

  worktree.status = "stopped";
  worktree.pid = null;
  writeJson("active.json", active);

  console.log(`[process] Stopped dev server for ${taskNo}`);
}
