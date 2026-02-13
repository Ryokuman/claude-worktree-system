import { NextResponse } from "next/server";
import { startDevServer } from "@/lib/process-manager";

// POST /api/worktrees/[taskNo]/start (A8)
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
