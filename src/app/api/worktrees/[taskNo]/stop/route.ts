import { NextResponse } from "next/server";
import { stopDevServer } from "@/lib/process-manager";

/**
 * POST /api/worktrees/:taskNo/stop
 *
 * 워크트리의 개발 서버를 중지한다. (A9)
 * 프로세스 그룹 SIGTERM → status: "stopped", pid: null
 *
 * Params: taskNo - 워크트리 식별자
 *
 * Response 200: { status: "stopped", taskNo: string }
 * Response 500: { error: string }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  try {
    const { taskNo } = await params;
    stopDevServer(taskNo);
    return NextResponse.json({ status: "stopped", taskNo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
