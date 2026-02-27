import { NextResponse } from "next/server";
import {
  readPermissions,
  writePermissions,
  applyToWorktree,
  applyToAllWorktrees,
} from "@/lib/claude-permissions";
import { readJson } from "@/lib/store";

export async function GET() {
  try {
    const data = readPermissions();
    const active = readJson("active.json") as {
      taskNo: string;
      taskName: string;
      path: string;
    }[];
    return NextResponse.json({ permissions: data, active });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      taskNo?: string;
      rules: string[];
    };

    if (!Array.isArray(body.rules)) {
      return NextResponse.json(
        { error: "rules must be an array" },
        { status: 400 },
      );
    }

    writePermissions(body.taskNo, body.rules);

    // Apply to affected worktrees
    if (!body.taskNo || body.taskNo === "default") {
      // Default changed → apply to all
      applyToAllWorktrees();
    } else {
      // Specific worktree changed → apply to that one
      const active = readJson("active.json") as {
        taskNo: string;
        path: string;
      }[];
      const wt = active.find((w) => w.taskNo === body.taskNo);
      if (wt?.path) {
        applyToWorktree(body.taskNo, wt.path);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
