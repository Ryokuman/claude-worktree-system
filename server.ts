import { createServer } from "http";
import { parse } from "url";
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

  // WebSocket upgrade: only intercept /ws/terminal/{sessionId}
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);

    if (pathname?.startsWith("/ws/terminal/")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      // Let Next.js HMR handle its own WebSocket upgrades
    }
  });

  // Handle terminal WebSocket connections
  wss.on("connection", (ws, req) => {
    const { pathname } = parse(req.url || "", true);
    const sessionId = pathname?.split("/ws/terminal/")[1];

    if (!sessionId) {
      ws.close(1008, "Missing session ID");
      return;
    }

    // Lazy-load terminal manager to avoid circular deps
    import("./src/lib/terminal-manager").then(({ terminalManager }) => {
      const session = terminalManager.getSession(sessionId);
      if (!session) {
        ws.close(1008, "Session not found");
        return;
      }

      const { pty } = session;

      // PTY → WebSocket
      const dataHandler = pty.onData((data: string) => {
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
            pty.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {
          // Not JSON, treat as regular input
        }
        pty.write(message);
      });

      ws.on("close", () => {
        dataHandler.dispose();
      });
    });
  });

  // Start background services after server is ready
  server.listen(port, async () => {
    console.log(`> Worktree Handler ready on http://${hostname}:${port}`);

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
          const res = await fetch(`http://localhost:${worktree.port}${env.HEALTHCHECK_PATH}`, {
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
