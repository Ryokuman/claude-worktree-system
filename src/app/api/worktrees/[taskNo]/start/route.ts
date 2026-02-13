import { NextResponse } from "next/server";
import { startDevServer } from "@/lib/process-manager";

/**
 * POST /api/worktrees/:taskNo/start
 *
 * 워크트리의 개발 서버를 시작한다. (A8)
 * npm install (node_modules 없으면) → next dev -p {port} spawn
 *
 * Params: taskNo - 워크트리 식별자 (e.g. "DV-494", "TTN-1")
 *
 * Response 200: { status: "started", taskNo: string }
 * Response 500: { error: string }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> }
) {
  try {
    const { taskNo } = await params;
    await startDevServer(taskNo);
    return NextResponse.json({ status: "started", taskNo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
