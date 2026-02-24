import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readJson } from "@/lib/store";
import type { ActiveWorktree } from "@/lib/types";

const ALLOWED_ACTIONS = ["push", "pull", "fetch"] as const;
type GitAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);
    const { action } = (await request.json()) as { action: string };

    if (!ALLOWED_ACTIONS.includes(action as GitAction)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 },
      );
    }

    const active = readJson<ActiveWorktree>("active.json");
    const worktree = active.find((w) => w.branch === decodedBranch);
    if (!worktree) {
      return NextResponse.json(
        { error: "Worktree not found" },
        { status: 404 },
      );
    }

    const cmd = action === "fetch" ? "git fetch --prune" : `git ${action}`;
    const output = execSync(cmd, {
      cwd: worktree.path,
      encoding: "utf-8",
      timeout: 30000,
    });

    return NextResponse.json({ success: true, output: output.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: unknown }).stderr).trim()
        : "";
    return NextResponse.json(
      { success: false, error: message, output: stderr },
      { status: 500 },
    );
  }
}
