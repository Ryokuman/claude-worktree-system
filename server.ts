import { createServer } from "http";
import { parse } from "url";
import fs from "fs";
import path from "path";
import next from "next";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";

// Load .env before anything else
import "./src/lib/env";

import {
  createSession,
  getSession,
  destroySession,
  getServerSession,
  markServerReady,
  attachViewer,
  detachViewer,
} from "./src/lib/pty-manager";

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

  // WebSocket upgrade: intercept /ws/terminal
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);

    if (pathname === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      // Let Next.js HMR handle its own WebSocket upgrades
    }
  });

  // ── Terminal WebSocket handler (uses pty-manager) ──
  wss.on("connection", async (ws, req) => {
    const { query } = parse(req.url || "", true);
    const sessionId = query.sessionId as string;
    const cwd = (query.cwd as string) || process.env.HOME || "/tmp";
    const rawInitialCommand = query.initialCommand as string | undefined;
    const taskNo = query.taskNo as string | undefined;
    const sessionName = query.name as string | undefined;
    const mode = (query.mode as string) || "terminal";

    // Build initialCommand: merge git-auth SSH + terminal-init config + explicit initialCommand
    let initialCommand = rawInitialCommand;
    if (taskNo && mode === "terminal") {
      try {
        const allCmds: string[] = [];

        // Git auth: prepend ssh-add command if configured
        try {
          const gitConfigFile = path.join(process.cwd(), "work-trees", "git-config.json");
          if (fs.existsSync(gitConfigFile)) {
            const gitConfig = JSON.parse(fs.readFileSync(gitConfigFile, "utf-8"));
            if (gitConfig.sshKeyPath) {
              allCmds.push(`ssh-add ${gitConfig.sshKeyPath} 2>/dev/null`);
            }
          }
        } catch {
          // Ignore git config errors
        }

        // Terminal init commands
        const initFile = path.join(process.cwd(), "work-trees", "terminal-init.json");
        if (fs.existsSync(initFile)) {
          const initData = JSON.parse(fs.readFileSync(initFile, "utf-8"));
          const defaultCmds: string[] = initData.default || [];
          const worktreeCmds: string[] = initData[taskNo] || [];
          allCmds.push(...defaultCmds, ...worktreeCmds);
        }

        if (allCmds.length > 0) {
          const joined = allCmds.join(" && ");
          initialCommand = initialCommand
            ? `${joined} && ${initialCommand}`
            : joined;
        }
      } catch {
        // Ignore init command errors
      }
    }

    if (!sessionId) {
      ws.send(`\r\n\x1b[31m[Missing sessionId]\x1b[0m\r\n`);
      ws.close();
      return;
    }

    let session = getSession(sessionId);

    if (!session) {
      if (mode === "server") {
        // Server sessions are created by the start API route, not WebSocket
        ws.send(`\r\n\x1b[90m[Server not running]\x1b[0m\r\n`);
        ws.close();
        return;
      }

      // Create new terminal session
      try {
        session = await createSession({
          sessionId,
          cwd,
          type: "terminal",
          taskNo,
          name: sessionName,
          initialCommand,
        });
      } catch (e) {
        ws.send(`\r\n\x1b[31mFailed to spawn shell: ${e}\x1b[0m\r\n`);
        ws.close();
        return;
      }
    }

    // Attach this WebSocket as a viewer (scrollback replay happens inside)
    attachViewer(sessionId, ws);

    // Handle messages from this viewer
    ws.on("message", (msg) => {
      const s = getSession(sessionId);
      if (!s) return;

      const message = msg.toString();
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          s.pty.resize(parsed.cols, parsed.rows);
          return;
        }
        if (parsed.type === "kill") {
          // Only terminal sessions can be killed via WebSocket
          if (s.type === "terminal") {
            destroySession(sessionId);
          }
          return;
        }
      } catch {}

      // Raw stdin: only for terminal sessions
      if (s.alive && s.type === "terminal") {
        s.pty.write(message);
      }
    });

    ws.on("close", () => {
      detachViewer(sessionId, ws);
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
    const { restoreApiToken } = await import("./src/lib/jira-cli");
    const { restoreGitToken } = await import("./src/lib/git-auth");

    // Restore tokens into process.env for terminal sessions
    restoreApiToken();
    restoreGitToken();

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

    // --- Health checker ---
    // Only polls worktrees that have a PTY session (server is on).
    // When server is off (no PTY session), absolutely no HTTP requests.
    // HTTP check serves as backup for server-ready detection.
    console.log(`[health] Starting health checker (interval: ${env.HEALTHCHECK_INTERVAL}ms)`);

    setInterval(async () => {
      const allWorktrees = readJson("active.json") as any[];

      for (const worktree of allWorktrees) {
        if (!worktree.port) continue;

        const session = getServerSession(worktree.taskNo);

        // No PTY session → server is off → skip (no HTTP request)
        if (!session) continue;

        // PTY session is dead → clean up, skip
        if (!session.alive) {
          destroySession(`server-${worktree.taskNo}`);
          continue;
        }

        // PTY session alive but not yet marked ready → try HTTP check as backup
        if (!session.serverReady) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const healthPath = worktree.healthCheckPath || env.HEALTHCHECK_PATH;
            await fetch(`http://localhost:${worktree.port}${healthPath}`, {
              signal: controller.signal,
              redirect: "manual",
            });
            clearTimeout(timeout);
            // HTTP responded → server is ready (backup for text detection)
            markServerReady(worktree.taskNo);
          } catch {
            clearTimeout(timeout);
            // Not ready yet — still starting, no action needed
          }
        }
      }
    }, env.HEALTHCHECK_INTERVAL);

    // --- Plan sync (bidirectional) ---
    startPlanSync(() => readJson("active.json") as any[]);
  });
});
