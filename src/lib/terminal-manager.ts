import * as pty from "node-pty";
import { randomUUID } from "crypto";

interface TerminalSession {
  id: string;
  pid: number;
  cwd: string;
  createdAt: string;
}

interface PtySession {
  id: string;
  pty: pty.IPty;
  cwd: string;
  createdAt: string;
}

class TerminalManager {
  private sessions = new Map<string, PtySession>();

  createSession(cwd: string, initialCommand?: string): TerminalSession {
    const id = randomUUID();
    const shell = process.env.SHELL || "/bin/zsh";

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd,
        env: {
          ...process.env,
          TERM: "xterm-256color",
        } as Record<string, string>,
      });
    } catch (e) {
      throw new Error(`Failed to spawn shell: ${e}`);
    }

    if (initialCommand) {
      ptyProcess.write(initialCommand + "\n");
    }

    const session: PtySession = {
      id,
      pty: ptyProcess,
      cwd,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(id, session);

    ptyProcess.onExit(() => {
      this.sessions.delete(id);
    });

    return {
      id,
      pid: ptyProcess.pid,
      cwd,
      createdAt: session.createdAt,
    };
  }

  getSession(id: string): PtySession | undefined {
    return this.sessions.get(id);
  }

  destroySession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.kill();
    this.sessions.delete(id);
    return true;
  }

  listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      pid: s.pty.pid,
      cwd: s.cwd,
      createdAt: s.createdAt,
    }));
  }
}

export const terminalManager = new TerminalManager();
