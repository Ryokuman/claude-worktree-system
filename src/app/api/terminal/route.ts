import { NextResponse } from "next/server";
import { terminalManager } from "@/lib/terminal-manager";

// POST /api/terminal - Create a new terminal session
export async function POST(request: Request) {
  try {
    const { cwd } = await request.json();
    if (!cwd) {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }

    const session = terminalManager.createSession(cwd);
    return NextResponse.json(session, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/terminal - List terminal sessions
export async function GET() {
  return NextResponse.json(terminalManager.listSessions());
}
