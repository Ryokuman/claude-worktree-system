import { NextResponse } from "next/server";
import { exec } from "child_process";
import { readJson } from "@/lib/store";
import type { ActiveWorktree } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskNo: string }> },
) {
  try {
    const { taskNo } = await params;

    const active = readJson<ActiveWorktree>("active.json");
    const worktree = active.find((w) => w.taskNo === taskNo);
    if (!worktree) {
      return NextResponse.json(
        { error: "Worktree not found" },
        { status: 404 },
      );
    }

    exec(`code "${worktree.path}"`);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
