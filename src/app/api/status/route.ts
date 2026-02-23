import { NextResponse } from "next/server";
import { readJson } from "@/lib/store";
import { listPlanFiles } from "@/lib/plan-manager";
import { env } from "@/lib/env";
import { getServerStatus } from "@/lib/pty-manager";
import type {
  ActiveWorktree,
  DeactiveBranch,
  EndedWorktree,
} from "@/lib/types";

/**
 * GET /api/status
 *
 * 전체 시스템 상태를 반환한다.
 * - active: 진행 중 워크트리 목록 (status는 PTY 세션 상태에서 실시간 파생)
 * - deactive: 미등록 브랜치 목록
 * - ended: 완료된 워크트리 목록
 */
export async function GET() {
  const active = readJson<ActiveWorktree>("active.json").map((w) => ({
    ...w,
    status: getServerStatus(w.taskNo),
    hasPlan: listPlanFiles(w.branch).length > 0,
  }));

  return NextResponse.json({
    active,
    deactive: readJson<DeactiveBranch>("deactive.json"),
    ended: readJson<EndedWorktree>("ended.json"),
    mainBranches: env.MAIN_BRANCHES,
  });
}
