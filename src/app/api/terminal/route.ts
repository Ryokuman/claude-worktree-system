import { NextResponse } from "next/server";
import { terminalManager } from "@/lib/terminal-manager";

/**
 * POST /api/terminal
 *
 * 새 터미널(PTY) 세션을 생성한다. (A5)
 * 생성된 sessionId로 ws://host/ws/terminal/{sessionId} 에 WebSocket 연결하여 사용.
 *
 * Body: { cwd: string, initialCommand?: string } - 터미널 시작 디렉토리 및 초기 명령어
 *
 * Response 201: TerminalSession { id, pid, cwd, createdAt }
 * Response 400: { error: "cwd is required" }
 * Response 500: { error: string }
 */
export async function POST(request: Request) {
  try {
    const { cwd, initialCommand } = await request.json();
    if (!cwd) {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }

    const session = terminalManager.createSession(cwd, initialCommand);
    return NextResponse.json(session, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/terminal
 *
 * 현재 활성 터미널 세션 목록을 반환한다.
 *
 * Response 200: TerminalSession[]
 */
export async function GET() {
  return NextResponse.json(terminalManager.listSessions());
}
