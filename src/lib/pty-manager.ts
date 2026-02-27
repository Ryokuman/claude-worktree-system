/**
 * Shared PTY session manager.
 *
 * Manages PTY sessions for both interactive terminals and dev-server processes.
 * Sessions are stored in globalThis to survive Next.js dev-mode HMR.
 *
 * Server status is derived from PTY session state:
 * - No session → "stopped"
 * - Session alive + !serverReady → "starting"
 * - Session alive + serverReady → "running"
 * - Session dead → "stopped"
 *
 * serverReady is set exclusively via markServerReady() (HTTP health check).
 *
 * Session types:
 * - "terminal": interactive shell, 5-min orphan cleanup, killable via WebSocket
 * - "server":   dev-server process, no auto-cleanup, kill ignored from WebSocket
 */

import type { WebSocket } from "ws";

// ── Types ──

export type SessionType = "terminal" | "server";
export type ServerStatus = "running" | "stopped" | "starting";

export interface PtySession {
  pty: import("node-pty").IPty;
  scrollback: string;
  alive: boolean;
  exitCode: number | null;
  viewers: Set<WebSocket>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  type: SessionType;
  taskNo: string | null;
  /** Display name for terminal tabs (e.g. "Terminal 1") */
  name: string | null;
  /** Timestamp when session was created (Date.now()) */
  startedAt: number;
  /** Whether HTTP health check confirmed server is responding */
  serverReady: boolean;
}

export interface CreateSessionOpts {
  sessionId: string;
  cwd: string;
  type: SessionType;
  taskNo?: string;
  name?: string;
  initialCommand?: string;
}

// ── Constants ──

const SCROLLBACK_LIMIT = 100_000;
const TERMINAL_ORPHAN_TIMEOUT = 5 * 60 * 1000; // 5 min

// ── globalThis-backed storage (survives HMR) ──

const sessions: Map<string, PtySession> =
  ((globalThis as any).__ptySessions ??= new Map<string, PtySession>());

// ── Lazy node-pty import ──

let ptyModule: typeof import("node-pty") | null = null;

async function getPty() {
  if (!ptyModule) ptyModule = await import("node-pty");
  return ptyModule;
}

// ── Minimal env for server sessions ──

function buildServerEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const keys = ["PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "TMPDIR"];
  for (const key of keys) {
    if (process.env[key]) env[key] = process.env[key]!;
  }
  env.TERM = "xterm-256color";
  return env;
}

// ── Status derivation ──

/**
 * Derive server status from PTY session state.
 * This is the source of truth — active.json status is just a hint.
 */
export function getServerStatus(taskNo: string): ServerStatus {
  const session = getServerSession(taskNo);
  if (!session) return "stopped";
  if (!session.alive) return "stopped";
  if (session.serverReady) return "running";
  return "starting";
}

/**
 * Mark a server session as ready (called by health checker when HTTP responds).
 */
export function markServerReady(taskNo: string): void {
  const session = getServerSession(taskNo);
  if (session && session.alive && !session.serverReady) {
    session.serverReady = true;
    console.log(`[pty] Server ${taskNo} marked ready via health check`);
  }
}

// ── Core API ──

export function getSession(sessionId: string): PtySession | undefined {
  return sessions.get(sessionId);
}

export function getServerSession(taskNo: string): PtySession | undefined {
  return sessions.get(`server-${taskNo}`);
}

export function getSessions(): Map<string, PtySession> {
  return sessions;
}

export async function createSession(opts: CreateSessionOpts): Promise<PtySession> {
  // Destroy existing session with same ID
  if (sessions.has(opts.sessionId)) {
    destroySession(opts.sessionId);
  }

  const pty = await getPty();
  const shell = process.env.SHELL || "/bin/zsh";

  const env =
    opts.type === "server"
      ? buildServerEnv()
      : ({ ...process.env, TERM: "xterm-256color" } as Record<string, string>);

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    cwd: opts.cwd,
    env,
  });

  const session: PtySession = {
    pty: ptyProcess,
    scrollback: "",
    alive: true,
    exitCode: null,
    viewers: new Set(),
    cleanupTimer: null,
    type: opts.type,
    taskNo: opts.taskNo ?? null,
    name: opts.name ?? null,
    startedAt: Date.now(),
    serverReady: false,
  };

  sessions.set(opts.sessionId, session);

  // PTY output → scrollback buffer + broadcast to all viewers
  ptyProcess.onData((data: string) => {
    session.scrollback += data;
    if (session.scrollback.length > SCROLLBACK_LIMIT) {
      session.scrollback = session.scrollback.slice(-SCROLLBACK_LIMIT);
    }
    for (const ws of session.viewers) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(data);
      }
    }
  });

  // PTY exit — keep session around for status derivation (don't auto-destroy)
  ptyProcess.onExit(({ exitCode }) => {
    session.alive = false;
    session.exitCode = exitCode;

    const elapsed = Date.now() - session.startedAt;
    if (session.type === "server") {
      console.log(
        `[pty] Server session ${opts.sessionId} exited (code: ${exitCode}, after ${Math.round(elapsed / 1000)}s)`,
      );
    }

    for (const ws of session.viewers) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "pty:exit", code: exitCode }));
      }
    }

    // Terminal sessions: schedule cleanup
    if (session.type === "terminal") {
      scheduleCleanup(opts.sessionId);
    }
    // Server sessions: keep around — cleaned up on next Start or Stop
  });

  // Send initial command
  if (opts.initialCommand) {
    ptyProcess.write(opts.initialCommand + "\n");
  }

  console.log(
    `[pty] Created ${opts.type} session ${opts.sessionId}` +
      (opts.taskNo ? ` for ${opts.taskNo}` : ""),
  );

  return session;
}

export function destroySession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  if (s.cleanupTimer) clearTimeout(s.cleanupTimer);
  if (s.alive) {
    try {
      s.pty.kill();
    } catch {}
  }
  sessions.delete(sessionId);
  console.log(`[pty] Destroyed session ${sessionId}`);
}

export function destroyServerSession(taskNo: string): void {
  destroySession(`server-${taskNo}`);
}

// ── Terminal session lookup by taskNo ──

export function getTerminalSessionsForTask(
  taskNo: string,
): { sessionId: string; name: string | null; alive: boolean }[] {
  const result: { sessionId: string; name: string | null; alive: boolean }[] = [];
  for (const [id, s] of sessions) {
    if (s.type === "terminal" && s.taskNo === taskNo) {
      result.push({ sessionId: id, name: s.name, alive: s.alive });
    }
  }
  return result;
}

// ── Viewer management ──

export function attachViewer(sessionId: string, ws: WebSocket): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;

  // Cancel cleanup timer on attach
  if (s.cleanupTimer) {
    clearTimeout(s.cleanupTimer);
    s.cleanupTimer = null;
  }

  s.viewers.add(ws);

  // Replay scrollback
  if (s.scrollback) {
    ws.send(JSON.stringify({ type: "pty:replay" }));
    ws.send(s.scrollback);
  }

  // If already dead, notify
  if (!s.alive) {
    ws.send(JSON.stringify({ type: "pty:exit", code: s.exitCode ?? 0 }));
  }

  return true;
}

export function detachViewer(sessionId: string, ws: WebSocket): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.viewers.delete(ws);

  // Only schedule cleanup for terminal sessions with no viewers
  if (s.type === "terminal" && s.viewers.size === 0) {
    scheduleCleanup(sessionId);
  }
  // Server sessions: no cleanup → session persists
}

// ── Internal helpers ──

function scheduleCleanup(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s || s.type === "server") return;
  if (s.cleanupTimer) clearTimeout(s.cleanupTimer);
  s.cleanupTimer = setTimeout(
    () => destroySession(sessionId),
    TERMINAL_ORPHAN_TIMEOUT,
  );
}
