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

  // Handle terminal WebSocket connections — spawn PTY directly
  wss.on("connection", async (ws, req) => {
    const { query } = parse(req.url || "", true);
    const cwd = (query.cwd as string) || process.env.HOME || "/tmp";
    const initialCommand = query.initialCommand as string | undefined;
    const shell = process.env.SHELL || "/bin/zsh";

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

    if (initialCommand) {
      ptyProcess.write(initialCommand + "\n");
    }

    // PTY → WebSocket
    const dataHandler = ptyProcess.onData((data: string) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    // WebSocket → PTY
    ws.on("message", (msg) => {
      const message = msg.toString();
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON, treat as regular input
      }
      ptyProcess.write(message);
    });

    ws.on("close", () => {
      dataHandler.dispose();
      ptyProcess.kill();
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
    setInterval(async () => {
      const running = (readJson("active.json") as any[]).filter((w) => w.status === "running");
      for (const worktree of running) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const healthPath = worktree.healthCheckPath || env.HEALTHCHECK_PATH;
          const res = await fetch(`http://localhost:${worktree.port}${healthPath}`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!res.ok) {
            console.log(`[health] ${worktree.taskNo} unhealthy (status ${res.status})`);
            const active = readJson("active.json") as any[];
            const wt = active.find((w) => w.taskNo === worktree.taskNo);
            if (wt) { wt.status = "stopped"; wt.pid = null; writeJson("active.json", active); }
          }
        } catch {
          console.log(`[health] ${worktree.taskNo} unreachable, marking as stopped`);
          const active = readJson("active.json") as any[];
          const wt = active.find((w) => w.taskNo === worktree.taskNo);
          if (wt) { wt.status = "stopped"; wt.pid = null; writeJson("active.json", active); }
        }
      }
    }, env.HEALTHCHECK_INTERVAL);
  });
});
