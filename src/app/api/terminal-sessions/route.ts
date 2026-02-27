import { NextRequest, NextResponse } from "next/server";
import { getTerminalSessionsForTask } from "@/lib/pty-manager";

export async function GET(req: NextRequest) {
  const taskNo = req.nextUrl.searchParams.get("taskNo");
  if (!taskNo) {
    return NextResponse.json({ error: "taskNo required" }, { status: 400 });
  }

  const sessions = getTerminalSessionsForTask(taskNo);
  return NextResponse.json({ sessions });
}
