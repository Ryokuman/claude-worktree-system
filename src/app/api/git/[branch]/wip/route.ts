import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readJson } from "@/lib/store";
import type { ActiveWorktree, WipFile } from "@/lib/types";

/**
 * GET /api/git/{branch}/wip
 *
 * Returns staged and unstaged file lists for the worktree.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);

    const active = readJson<ActiveWorktree>("active.json");
    const worktree = active.find((w) => w.branch === decodedBranch);
    if (!worktree) {
      return NextResponse.json(
        { error: "Worktree not found" },
        { status: 404 },
      );
    }

    const cwd = worktree.path;

    // Get staged files
    const stagedRaw = execSync("git diff --cached --name-status", {
      cwd,
      encoding: "utf-8",
    }).trim();

    const staged: WipFile[] = stagedRaw
      ? stagedRaw.split("\n").map((l) => {
          const [status, ...rest] = l.split("\t");
          return { status, file: rest.join("\t") };
        })
      : [];

    // Get unstaged files (modified + untracked)
    const unstagedRaw = execSync(
      "git status --porcelain",
      { cwd, encoding: "utf-8" },
    ).trim();

    const unstaged: WipFile[] = [];
    if (unstagedRaw) {
      for (const line of unstagedRaw.split("\n")) {
        const xy = line.substring(0, 2);
        const file = line.substring(3);

        // Index X = staged status, Y = worktree status
        // We want files with worktree changes (Y != ' ' and Y != '?')
        // Plus untracked files (??)
        if (xy === "??") {
          unstaged.push({ status: "??", file });
        } else if (xy[1] !== " ") {
          unstaged.push({ status: xy[1], file });
        }
      }
    }

    // Get diff for staged
    let stagedDiff = "";
    try {
      stagedDiff = execSync("git diff --cached", {
        cwd,
        encoding: "utf-8",
        maxBuffer: 2 * 1024 * 1024,
      });
      if (stagedDiff.length > 50000) {
        stagedDiff = stagedDiff.substring(0, 50000) + "\n\n... (truncated)";
      }
    } catch {
      // ignore
    }

    // Get diff for unstaged
    let unstagedDiff = "";
    try {
      unstagedDiff = execSync("git diff", {
        cwd,
        encoding: "utf-8",
        maxBuffer: 2 * 1024 * 1024,
      });
      if (unstagedDiff.length > 50000) {
        unstagedDiff =
          unstagedDiff.substring(0, 50000) + "\n\n... (truncated)";
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      staged,
      unstaged,
      stagedDiff,
      unstagedDiff,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
