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

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: TerminalOptions = {},
): TerminalControls {
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionIdRef = useRef<string>(generateId());
  const reconnectRef = useRef(0);
  const disposed = useRef(false);
  const isFirstConnect = useRef(true);

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

    disposed.current = false;
    isFirstConnect.current = true;
    reconnectRef.current = 0;
    const sessionId = sessionIdRef.current;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
        selectionBackground: "#3b82f680",
      },
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(container);

    const rafId = requestAnimationFrame(() => safeFit(fitAddon));

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      safeFit(fitAddon);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
        );
      }
    });
    resizeObserver.observe(container);

    function connect() {
      if (disposed.current) return;

      const params = new URLSearchParams();
      params.set("sessionId", sessionId);
      if (options.cwd) params.set("cwd", options.cwd);
      // initialCommand only on first connect
      if (isFirstConnect.current && options.initialCommand) {
        params.set("initialCommand", options.initialCommand);
      }
      isFirstConnect.current = false;

      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal?${params}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let gotPtyExit = false;
      let expectingReplay = false;

      ws.onopen = () => {
        reconnectRef.current = 0;
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
              // Server is about to replay scrollback — clear terminal first
              expectingReplay = true;
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
        if (expectingReplay) {
          expectingReplay = false;
        }
        term.write(data);
      };

      ws.onclose = () => {
        if (disposed.current || gotPtyExit) return;
        // Connection lost — auto reconnect (laptop sleep, network drop, etc.)
        term.write("\r\n\x1b[33m[Connection lost]\x1b[0m");
        if (reconnectRef.current < MAX_RECONNECT) {
          reconnectRef.current++;
          term.write(` \x1b[36m(reconnecting...)\x1b[0m\r\n`);
          setTimeout(() => connect(), RECONNECT_DELAY);
        } else {
          term.write(
            `\r\n\x1b[90m[Reconnect failed — close and reopen terminal]\x1b[0m\r\n`,
          );
        }
      };
    }

    // User input → WebSocket
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    connect();

    return () => {
      disposed.current = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      fitAddonRef.current = null;
      termRef.current = null;
      // Tell server to kill the PTY
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "kill" }));
      }
      if (ws) ws.close();
      term.dispose();
      // Reset for potential remount
      sessionIdRef.current = generateId();
    };
  }, [containerRef, options.cwd, options.initialCommand]);

  return { refit, sendData };
}
