import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";

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

    // Initialize background services
    const { initWatcher } = await import("./src/lib/watcher");
    const { startHealthChecker } = await import("./src/lib/health-checker");

    initWatcher();
    startHealthChecker();
  });
});
