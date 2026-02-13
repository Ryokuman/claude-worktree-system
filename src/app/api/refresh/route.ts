import { NextResponse } from "next/server";
import { classifyBranches } from "@/lib/classifier";

/**
 * POST /api/refresh
 *
 * Git 상태를 재스캔하여 브랜치를 active/deactive로 재분류한다. (A1, A2)
 * Body: 없음
 *
 * Response 200: { status: "refreshed" }
 * Response 500: { error: string }
 */
export async function POST() {
  try {
    classifyBranches();
    return NextResponse.json({ status: "refreshed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
