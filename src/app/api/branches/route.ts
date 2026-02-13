import { NextResponse } from "next/server";
import { getDeactive } from "@/lib/store";

/**
 * GET /api/branches
 *
 * 비활성(미등록) 브랜치 목록을 반환한다.
 * 워크트리 추가 다이얼로그(A4)의 SelectBox 데이터로 사용된다.
 *
 * Response 200: DeactiveBranch[]
 */
export async function GET() {
  return NextResponse.json(getDeactive());
}
