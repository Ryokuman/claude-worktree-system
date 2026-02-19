import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readJson } from "@/lib/store";
import type { ActiveWorktree } from "@/lib/types";

/**
 * GET /api/git/{branch}/log
 *
 * Returns commits with parent info so the client can compute graph lanes.
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

    const SEP = "@@F@@";
    const raw = execSync(
      `git log --format='${SEP}%H${SEP}%P${SEP}%h${SEP}%an${SEP}%ar${SEP}%s${SEP}%D${SEP}' --all --topo-order -150`,
      { cwd, encoding: "utf-8", maxBuffer: 2 * 1024 * 1024 },
    );

    const commits: {
      hash: string;
      parents: string[];
      shortHash: string;
      author: string;
      relativeDate: string;
      message: string;
      refs: string;
    }[] = [];

    for (const line of raw.split("\n")) {
      if (!line.includes(SEP)) continue;
      const parts = line.split(SEP).filter(Boolean);
      if (parts.length < 6) continue;

      commits.push({
        hash: parts[0],
        parents: parts[1] ? parts[1].split(" ").filter(Boolean) : [],
        shortHash: parts[2],
        author: parts[3],
        relativeDate: parts[4],
        message: parts[5],
        refs: parts[6] || "",
      });
    }

    // Detect WIP (uncommitted changes)
    let hasWip = false;
    try {
      const status = execSync("git status --porcelain", {
        cwd,
        encoding: "utf-8",
      }).trim();
      hasWip = status.length > 0;
    } catch {
      // ignore
    }

    return NextResponse.json({ commits, hasWip });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
