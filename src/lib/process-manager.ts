import { getActive, updateActive } from "./store";

export function stopDevServer(taskNo: string): void {
  const worktree = getActive().find((w) => w.taskNo === taskNo);
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

  updateActive(taskNo, {
    status: "stopped",
    pid: null,
  });

  console.log(`[process] Stopped dev server for ${taskNo}`);
}
