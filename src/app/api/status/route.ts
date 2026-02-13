import { NextResponse } from "next/server";
import { getActive, getDeactive, getEnded } from "@/lib/store";
import { listPlanFiles } from "@/lib/plan-manager";

/**
 * GET /api/status
 *
 * 전체 시스템 상태를 반환한다.
 * - active: 진행 중 워크트리 목록 (hasPlan 필드 포함)
 * - deactive: 미등록 브랜치 목록
 * - ended: 완료된 워크트리 목록
 *
 * Response 200: { active: ActiveWorktree[], deactive: DeactiveBranch[], ended: EndedWorktree[] }
 */
export async function GET() {
  const active = getActive().map((w) => ({
    ...w,
    hasPlan: listPlanFiles(w.branch).length > 0,
  }));

  return NextResponse.json({
    active,
    deactive: getDeactive(),
    ended: getEnded(),
  });
}
