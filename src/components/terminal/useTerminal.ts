"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface TerminalOptions {
  cwd?: string;
  initialCommand?: string;
}

export interface TerminalControls {
  refit: () => void;
  sendData: (data: string) => void;
}

const RECONNECT_DELAY = 1500;
const MAX_RECONNECT = 10;

function safeFit(fitAddon: FitAddon) {
  try {
    fitAddon.fit();
  } catch {
    // Renderer not ready yet — will fit on next resize
  }
}

let sessionCounter = 0;
function generateId() {
  return `s${++sessionCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: TerminalOptions = {},
): TerminalControls {
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refit = useCallback(() => {
    if (fitAddonRef.current) {
      safeFit(fitAddonRef.current);
    }
  }, []);

  const sendData = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Per-effect-run state — not shared across StrictMode re-runs
    let disposed = false;
    let currentWs: WebSocket | null = null;
    let reconnectCount = 0;
    let isFirstConnect = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const sessionId = generateId();

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      macOptionIsMeta: true,
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
        selectionBackground: "#3b82f680",
      },
    });

    // Mac keyboard shortcuts → terminal sequences
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      // Cmd+Backspace → Ctrl+U (delete line)
      if (e.metaKey && e.key === "Backspace") {
        term.input("\x15");
        return false;
      }
      // Cmd+← → Ctrl+A (beginning of line)
      if (e.metaKey && e.key === "ArrowLeft") {
        term.input("\x01");
        return false;
      }
      // Cmd+→ → Ctrl+E (end of line)
      if (e.metaKey && e.key === "ArrowRight") {
        term.input("\x05");
        return false;
      }
      return true;
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(container);

    const rafId = requestAnimationFrame(() => safeFit(fitAddon));

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      safeFit(fitAddon);
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.send(
          JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
        );
      }
    });
    resizeObserver.observe(container);

    // User input → WebSocket
    term.onData((data) => {
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.send(data);
      }
    });

    function connect() {
      if (disposed) return;

      const params = new URLSearchParams();
      params.set("sessionId", sessionId);
      if (options.cwd) params.set("cwd", options.cwd);
      if (isFirstConnect && options.initialCommand) {
        params.set("initialCommand", options.initialCommand);
      }
      isFirstConnect = false;

      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal?${params}`;
      const ws = new WebSocket(wsUrl);
      currentWs = ws;
      wsRef.current = ws;

      let gotPtyExit = false;

      ws.onopen = () => {
        reconnectCount = 0;
        ws.send(
          JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
        );
      };

      ws.onmessage = (event) => {
        const data = event.data;
        if (typeof data === "string" && data.startsWith("{")) {
          try {
            const msg = JSON.parse(data);
            if (msg.type === "pty:replay") {
              term.reset();
              return;
            }
            if (msg.type === "pty:exit") {
              gotPtyExit = true;
              term.write(
                `\r\n\x1b[33m[Process exited with code ${msg.code ?? 0}]\x1b[0m\r\n`,
              );
              return;
            }
          } catch {
            // Not a control message
          }
        }
        term.write(data);
      };

      ws.onclose = () => {
        if (disposed || gotPtyExit) return;
        term.write("\r\n\x1b[33m[Connection lost]\x1b[0m");
        if (reconnectCount < MAX_RECONNECT) {
          reconnectCount++;
          term.write(` \x1b[36m(reconnecting ${reconnectCount}/${MAX_RECONNECT}...)\x1b[0m\r\n`);
          reconnectTimer = setTimeout(() => connect(), RECONNECT_DELAY);
        } else {
          term.write(
            `\r\n\x1b[90m[Reconnect failed — close and reopen terminal]\x1b[0m\r\n`,
          );
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      fitAddonRef.current = null;
      // Tell server to kill PTY session
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.send(JSON.stringify({ type: "kill" }));
      }
      if (currentWs) currentWs.close();
      currentWs = null;
      wsRef.current = null;
      term.dispose();
    };
  }, [containerRef, options.cwd, options.initialCommand]);

  return { refit, sendData };
}
