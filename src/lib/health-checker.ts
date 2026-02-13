import { env } from "./env";
import { getActive, updateActive } from "./store";

let intervalId: ReturnType<typeof setInterval> | null = null;

async function checkHealth(): Promise<void> {
  const active = getActive();
  const running = active.filter((w) => w.status === "running");

  for (const worktree of running) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`http://localhost:${worktree.port}${env.HEALTHCHECK_PATH}`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.log(`[health] ${worktree.taskNo} unhealthy (status ${res.status})`);
        updateActive(worktree.taskNo, { status: "stopped", pid: null });
      }
    } catch {
      console.log(`[health] ${worktree.taskNo} unreachable, marking as stopped`);
      updateActive(worktree.taskNo, { status: "stopped", pid: null });
    }
  }
}

export function startHealthChecker(): void {
  if (intervalId) return;
  console.log(`[health] Starting health checker (interval: ${env.HEALTHCHECK_INTERVAL}ms)`);
  intervalId = setInterval(checkHealth, env.HEALTHCHECK_INTERVAL);
}

export function stopHealthChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
