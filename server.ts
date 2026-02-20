import { createServer } from "http";
import { parse } from "url";
import fs from "fs";
import path from "path";
import next from "next";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";

// Load .env before anything else
import "./src/lib/env";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.HANDLER_PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  const wssLogs = new WebSocketServer({ noServer: true });

  // ── Persistent PTY session management ──
  interface PtySession {
    pty: import("node-pty").IPty;
    scrollback: string;
    alive: boolean;
    exitCode: number | null;
    ws: import("ws").WebSocket | null;
    cleanupTimer: ReturnType<typeof setTimeout> | null;
  }

  const ptySessions = new Map<string, PtySession>();
  const SCROLLBACK_LIMIT = 100_000;
  const SESSION_ORPHAN_TIMEOUT = 5 * 60 * 1000; // 5 min

  function destroySession(sessionId: string) {
    const s = ptySessions.get(sessionId);
    if (!s) return;
    if (s.cleanupTimer) clearTimeout(s.cleanupTimer);
    if (s.alive) { try { s.pty.kill(); } catch {} }
    ptySessions.delete(sessionId);
  }

  function scheduleCleanup(sessionId: string) {
    const s = ptySessions.get(sessionId);
    if (!s) return;
    if (s.cleanupTimer) clearTimeout(s.cleanupTimer);
    s.cleanupTimer = setTimeout(() => destroySession(sessionId), SESSION_ORPHAN_TIMEOUT);
  }

  // WebSocket upgrade: intercept /ws/terminal and /ws/logs
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);

    if (pathname === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (pathname === "/ws/logs") {
      wssLogs.handleUpgrade(req, socket, head, (ws) => {
        wssLogs.emit("connection", ws, req);
      });
    } else {
      // Let Next.js HMR handle its own WebSocket upgrades
    }
  });

  // Handle terminal WebSocket connections with session persistence
  wss.on("connection", async (ws, req) => {
    const { query } = parse(req.url || "", true);
    const sessionId = query.sessionId as string;
    const cwd = (query.cwd as string) || process.env.HOME || "/tmp";
    const initialCommand = query.initialCommand as string | undefined;
    const shell = process.env.SHELL || "/bin/zsh";

    if (!sessionId) {
      ws.send(`\r\n\x1b[31m[Missing sessionId]\x1b[0m\r\n`);
      ws.close();
      return;
    }

    const existing = ptySessions.get(sessionId);

    // ── Reattach to existing session ──
    if (existing) {
      if (existing.cleanupTimer) clearTimeout(existing.cleanupTimer);
      existing.cleanupTimer = null;
      existing.ws = ws;

      // Replay scrollback so client sees what it missed
      if (existing.scrollback) {
        ws.send(JSON.stringify({ type: "pty:replay" }));
        ws.send(existing.scrollback);
      }

      if (!existing.alive) {
        ws.send(JSON.stringify({ type: "pty:exit", code: existing.exitCode ?? 0 }));
        destroySession(sessionId);
        return;
      }

      // WebSocket → PTY
      ws.on("message", (msg) => {
        if (!existing.alive) return;
        const message = msg.toString();
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === "resize" && parsed.cols && parsed.rows) {
            existing.pty.resize(parsed.cols, parsed.rows);
            return;
          }
          if (parsed.type === "kill") {
            destroySession(sessionId);
            return;
          }
        } catch {}
        existing.pty.write(message);
      });

      ws.on("close", () => {
        if (existing.ws === ws) existing.ws = null;
        if (ptySessions.has(sessionId)) scheduleCleanup(sessionId);
      });

      return;
    }

    // ── Create new session ──
    let ptyProcess: import("node-pty").IPty;
    try {
      const pty = await import("node-pty");
      ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd,
        env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
      });
    } catch (e) {
      ws.send(`\r\n\x1b[31mFailed to spawn shell: ${e}\x1b[0m\r\n`);
      ws.close();
      return;
    }

    const session: PtySession = {
      pty: ptyProcess,
      scrollback: "",
      alive: true,
      exitCode: null,
      ws,
      cleanupTimer: null,
    };
    ptySessions.set(sessionId, session);

    if (initialCommand) {
      ptyProcess.write(initialCommand + "\n");
    }

    // PTY → client (+ scrollback buffer)
    ptyProcess.onData((data: string) => {
      session.scrollback += data;
      if (session.scrollback.length > SCROLLBACK_LIMIT) {
        session.scrollback = session.scrollback.slice(-SCROLLBACK_LIMIT);
      }
      if (session.ws && session.ws.readyState === session.ws.OPEN) {
        session.ws.send(data);
      }
    });

    // PTY exit
    ptyProcess.onExit(({ exitCode }) => {
      session.alive = false;
      session.exitCode = exitCode;
      if (session.ws && session.ws.readyState === session.ws.OPEN) {
        session.ws.send(JSON.stringify({ type: "pty:exit", code: exitCode }));
      }
      // Don't destroy immediately — let client reconnect and see exit status
      scheduleCleanup(sessionId);
    });

    // WebSocket → PTY
    ws.on("message", (msg) => {
      if (!session.alive) return;
      const message = msg.toString();
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
        if (parsed.type === "kill") {
          destroySession(sessionId);
          return;
        }
      } catch {}
      ptyProcess.write(message);
    });

    ws.on("close", () => {
      if (session.ws === ws) session.ws = null;
      if (ptySessions.has(sessionId)) scheduleCleanup(sessionId);
    });
  });

  // ── Log streaming WebSocket handler ──
  wssLogs.on("connection", (ws, req) => {
    const { query } = parse(req.url || "", true);
    const taskNo = query.taskNo as string;

    if (!taskNo) {
      ws.close(1008, "Missing taskNo");
      return;
    }

    const { getLogPath } = require("./src/lib/log-manager");
    const logPath = getLogPath(taskNo) as string;
    const logDir = path.dirname(logPath);
    let offset = 0;

    // Send existing log content or notify no log file
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf-8");
      if (content.length > 0 && ws.readyState === ws.OPEN) {
        ws.send(content);
      }
      offset = fs.statSync(logPath).size;
    } else if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "log:no-file" }));
    }

    function sendDelta() {
      try {
        if (!fs.existsSync(logPath)) return;
        const stat = fs.statSync(logPath);
        if (stat.size > offset) {
          const fd = fs.openSync(logPath, "r");
          const buf = Buffer.alloc(stat.size - offset);
          fs.readSync(fd, buf, 0, buf.length, offset);
          fs.closeSync(fd);
          offset = stat.size;
          if (ws.readyState === ws.OPEN) {
            ws.send(buf.toString("utf-8"));
          }
        } else if (stat.size < offset) {
          // File was truncated (cleared)
          offset = 0;
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "log:clear" }));
          }
        }
      } catch {
        // File may not exist yet
      }
    }

    // Watch log file (and directory for file creation)
    const logWatcher = watch(fs.existsSync(logPath) ? logPath : logDir, {
      persistent: false,
      ignoreInitial: true,
      depth: 0,
    });

    let watchingFile = fs.existsSync(logPath);

    logWatcher.on("change", sendDelta);
    logWatcher.on("add", (addedPath: string) => {
      if (path.resolve(addedPath) === path.resolve(logPath) && !watchingFile) {
        watchingFile = true;
        logWatcher.add(logPath);
        sendDelta();
      }
    });

    // Handle client messages (clear)
    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "clear") {
          const { clearLog } = require("./src/lib/log-manager");
          clearLog(taskNo);
          offset = 0;
        }
      } catch {}
    });

    ws.on("close", () => {
      logWatcher.close();
    });
  });

  // Start background services after server is ready
  server.listen(port, async () => {
    console.log(`> Worktree Handler ready on http://${hostname}:${port}`);

    // Ensure plan directories exist
    const planBase = path.resolve(process.cwd(), "plan");
    fs.mkdirSync(path.join(planBase, "active"), { recursive: true });
    fs.mkdirSync(path.join(planBase, "ended"), { recursive: true });

    const { env } = await import("./src/lib/env");
    const { classifyBranches } = await import("./src/lib/classifier");
    const { readJson, writeJson } = await import("./src/lib/store");
    const { startPlanSync } = await import("./src/lib/plan-sync");

    // --- Git watcher (inline of initWatcher) ---
    const refsPath = path.join(env.MAIN_REPO_PATH, ".git", "refs");
    console.log("[watcher] Watching git refs at:", refsPath);

    classifyBranches();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const watcher = watch(refsPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 5,
    });
    watcher.on("all", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("[watcher] Git change detected, classifying branches...");
        classifyBranches();
      }, 2000);
    });
    watcher.on("error", (err) => console.error("[watcher] Error:", err));

    // --- Health checker (inline of startHealthChecker) ---
    console.log(`[health] Starting health checker (interval: ${env.HEALTHCHECK_INTERVAL}ms)`);

    function findPidByPort(port: number): number | null {
      try {
        const { execSync } = require("child_process");
        const output = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
        if (!output) return null;
        const pid = parseInt(output.split("\n")[0], 10);
        return Number.isNaN(pid) ? null : pid;
      } catch { return null; }
    }

    setInterval(async () => {
      const allWorktrees = readJson("active.json") as any[];

      for (const worktree of allWorktrees) {
        if (!worktree.port) continue;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        let portAlive = false;

        try {
          const healthPath = worktree.healthCheckPath || env.HEALTHCHECK_PATH;
          await fetch(`http://localhost:${worktree.port}${healthPath}`, {
            signal: controller.signal,
            redirect: "manual",
          });
          clearTimeout(timeout);
          portAlive = true;
        } catch {
          clearTimeout(timeout);
          portAlive = false;
        }

        if (worktree.status === "running" && !portAlive) {
          // Running → Stopped: port is unreachable, mark as stopped
          console.log(`[health] ${worktree.taskNo} port ${worktree.port} unreachable, marking as stopped`);
          const active = readJson("active.json") as any[];
          const wt = active.find((w: any) => w.taskNo === worktree.taskNo);
          if (wt) { wt.status = "stopped"; wt.pid = null; writeJson("active.json", active); }
        } else if (worktree.status === "stopped" && portAlive) {
          // Stopped → Running: recover orphaned process
          const pid = worktree.pid || findPidByPort(worktree.port);
          console.log(`[health] ${worktree.taskNo} port ${worktree.port} is alive (PID: ${pid}), recovering to running`);
          const active = readJson("active.json") as any[];
          const wt = active.find((w: any) => w.taskNo === worktree.taskNo);
          if (wt) { wt.status = "running"; wt.pid = pid; writeJson("active.json", active); }
        }
      }
    }, env.HEALTHCHECK_INTERVAL);

    // --- Plan sync (bidirectional) ---
    startPlanSync(() => readJson("active.json") as any[]);
  });
});
