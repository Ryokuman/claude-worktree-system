import { NextResponse } from "next/server";
import {
  readGitConfig,
  writeGitConfig,
  loadGitToken,
  saveGitToken,
  hasSshPassphrase,
  saveSshPassphrase,
} from "@/lib/git-auth";
import { applyToAllWorktrees } from "@/lib/claude-permissions";
import type { GitAuthConfig } from "@/lib/types";

export async function GET() {
  try {
    const config = readGitConfig();
    const hasToken = !!loadGitToken();
    const hasPassphrase = hasSshPassphrase();
    return NextResponse.json({ config, hasToken, hasPassphrase });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as GitAuthConfig & {
      token?: string;
      sshPassphrase?: string;
    };

    if (!body.sshKeyPath && !body.provider && !body.username && !body.token && !body.sshPassphrase) {
      return NextResponse.json(
        { error: "At least one field required" },
        { status: 400 },
      );
    }

    const config: GitAuthConfig = {
      sshKeyPath: body.sshKeyPath || "",
      provider: body.provider || "github",
      username: body.username || "",
    };

    writeGitConfig(config);

    if (body.token) {
      saveGitToken(body.token);
    }

    if (body.sshPassphrase) {
      saveSshPassphrase(body.sshPassphrase);
    }

    // Re-apply CLAUDE.md prompt to all worktrees (git info changed)
    try { applyToAllWorktrees(); } catch {}

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
