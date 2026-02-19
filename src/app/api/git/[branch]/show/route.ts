import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readJson } from "@/lib/store";
import type { ActiveWorktree } from "@/lib/types";

/**
 * GET /api/git/{branch}/show?hash=abc123
 *
 * Returns commit detail + diff for a specific commit.
 */

export interface GitFileChange {
  status: string;    // "M", "A", "D", "R"
  file: string;
}

export interface GitCommitDetail {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: GitFileChange[];
  diff: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);
    const url = new URL(request.url);
    const hash = url.searchParams.get("hash");

    if (!hash) {
      return NextResponse.json({ error: "hash required" }, { status: 400 });
    }

    const active = readJson<ActiveWorktree>("active.json");
    const worktree = active.find((w) => w.branch === decodedBranch);
    if (!worktree) {
      return NextResponse.json(
        { error: "Worktree not found" },
        { status: 404 },
      );
    }

    const cwd = worktree.path;
    const file = url.searchParams.get("file");

    // Commit metadata
    const meta = execSync(
      `git show --no-patch --format='%H%n%an%n%ai%n%B' ${hash}`,
      { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 },
    ).trim();
    const metaLines = meta.split("\n");

    // Changed files
    const nameStatus = execSync(
      `git diff-tree --no-commit-id --name-status -r ${hash}`,
      { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 },
    ).trim();

    const files: GitFileChange[] = nameStatus
      ? nameStatus.split("\n").map((l) => {
          const [status, ...rest] = l.split("\t");
          return { status, file: rest.join("\t") };
        })
      : [];

    // Diff — per-file or full
    let diff = "";
    try {
      const diffCmd = file
        ? `git show --format='' ${hash} -- ${JSON.stringify(file)}`
        : `git show --stat --patch --format='' ${hash}`;
      diff = execSync(diffCmd, {
        cwd,
        encoding: "utf-8",
        maxBuffer: 2 * 1024 * 1024,
      });
      if (diff.length > 50000) {
        diff = diff.substring(0, 50000) + "\n\n... (truncated)";
      }
    } catch {
      diff = "(diff unavailable)";
    }

    const detail: GitCommitDetail = {
      hash: metaLines[0] || hash,
      author: metaLines[1] || "",
      date: metaLines[2] || "",
      message: metaLines.slice(3).join("\n").trim(),
      files,
      diff,
    };

    return NextResponse.json(detail);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
