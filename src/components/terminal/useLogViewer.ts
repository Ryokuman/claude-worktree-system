"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const MAX_RECONNECT = 10;
const RECONNECT_DELAY = 1500;

export interface LogViewerControls {
  refit: () => void;
  clear: () => void;
  noLogFile: boolean;
}

export function useLogViewer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  taskNo: string,
): LogViewerControls {
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [noLogFile, setNoLogFile] = useState(false);

  const refit = useCallback(() => {
    if (fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch {}
    }
  }, []);

  const clear = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "clear" }));
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let currentWs: WebSocket | null = null;
    let reconnectCount = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const term = new Terminal({
      disableStdin: true,
      cursorBlink: false,
      cursorStyle: "bar",
      cursorInactiveStyle: "none",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "transparent",
        selectionBackground: "#3b82f680",
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(container);

    const rafId = requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {}
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {}
    });
    resizeObserver.observe(container);

    function connect() {
      if (disposed) return;

      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/logs?taskNo=${encodeURIComponent(taskNo)}`;
      const ws = new WebSocket(wsUrl);
      currentWs = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount = 0;
      };

      ws.onmessage = (event) => {
        const data = event.data;
        // Check for control messages
        if (typeof data === "string" && data.startsWith("{")) {
          try {
            const msg = JSON.parse(data);
            if (msg.type === "log:clear") {
              term.clear();
              return;
            }
            if (msg.type === "log:no-file") {
              setNoLogFile(true);
              return;
            }
          } catch {
            // Not JSON — regular log data
          }
        }
        setNoLogFile(false);
        term.write(data);
      };

      ws.onclose = () => {
        if (disposed) return;
        if (reconnectCount < MAX_RECONNECT) {
          reconnectCount++;
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
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
      if (currentWs) currentWs.close();
      currentWs = null;
      wsRef.current = null;
      term.dispose();
    };
  }, [containerRef, taskNo]);

  return { refit, clear, noLogFile };
}
