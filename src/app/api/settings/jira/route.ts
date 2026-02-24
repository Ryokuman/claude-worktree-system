import { NextResponse } from "next/server";
import {
  checkInstallation,
  readConfig,
  writeConfig,
  loadApiToken,
} from "@/lib/jira-cli";
import type { JiraCliConfig } from "@/lib/types";

/**
 * GET /api/settings/jira
 * Returns jira-cli installation status, config, and token availability.
 */
export async function GET() {
  try {
    const status = checkInstallation();
    const config = status.configExists ? readConfig() : null;
    const hasToken = !!loadApiToken();

    return NextResponse.json({ status, config, hasToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/settings/jira
 * Saves jira-cli config file + API token.
 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as JiraCliConfig & {
      apiToken?: string;
    };

    if (!body.server || !body.login || !body.projectKey || !body.installationType) {
      return NextResponse.json(
        { error: "Missing required fields: server, login, projectKey, installationType" },
        { status: 400 },
      );
    }

    if (body.installationType !== "cloud" && body.installationType !== "local") {
      return NextResponse.json(
        { error: "installationType must be 'cloud' or 'local'" },
        { status: 400 },
      );
    }

    writeConfig(
      {
        server: body.server,
        login: body.login,
        projectKey: body.projectKey,
        installationType: body.installationType,
        boardId: body.boardId,
      },
      body.apiToken || undefined,
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
