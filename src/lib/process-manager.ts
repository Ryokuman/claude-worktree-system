import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getActive, updateActive } from "./store";
import { findAvailablePort } from "./port-manager";

export async function startDevServer(taskNo: string): Promise<void> {
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
}

export function stopDevServer(taskNo: string): void {
  const worktree = getActive().find((w) => w.taskNo === taskNo);
  if (!worktree) throw new Error(`Worktree ${taskNo} not found`);
  if (!worktree.pid) throw new Error(`${taskNo} has no running process`);

  try {
    // Kill the process group
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
