import { execSync } from "child_process";
import { NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";
import { env } from "@/lib/env";
import type { ActiveWorktree } from "@/lib/types";

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
 * POST /api/health-check
 *
 * 모든 워크트리의 서버 상태를 즉시 점검하여 active.json을 동기화한다.
 * - running인데 포트 죽음 → stopped
 * - stopped인데 포트 살아있음 → running 복구
 */
export async function POST() {
  try {
    const active = readJson<ActiveWorktree>("active.json");
    const results: { taskNo: string; before: string; after: string }[] = [];

    for (const wt of active) {
      if (!wt.port) continue;

      const before = wt.status;
      let portAlive = false;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const healthPath = wt.healthCheckPath || env.HEALTHCHECK_PATH;
        await fetch(`http://localhost:${wt.port}${healthPath}`, {
          signal: controller.signal,
          redirect: "manual",
        });
        clearTimeout(timeout);
        portAlive = true;
      } catch {
        portAlive = false;
      }

      if (wt.status === "running" && !portAlive) {
        // Port unreachable = stopped, regardless of PID existence
        wt.status = "stopped";
        wt.pid = null;
      } else if (wt.status === "stopped" && portAlive) {
        const pid = wt.pid || findPidByPort(wt.port);
        wt.status = "running";
        wt.pid = pid;
      }

      if (before !== wt.status) {
        results.push({ taskNo: wt.taskNo, before, after: wt.status });
      }
    }

    writeJson("active.json", active);
    return NextResponse.json({ status: "checked", changes: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
