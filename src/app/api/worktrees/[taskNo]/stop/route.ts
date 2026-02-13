import { NextResponse } from "next/server";
import { stopDevServer } from "@/lib/process-manager";

// POST /api/worktrees/[taskNo]/stop (A9)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> }
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
