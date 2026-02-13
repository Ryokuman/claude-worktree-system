"use client";

import { useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface TerminalOptions {
  cwd?: string;
  initialCommand?: string;
}

function safeFit(fitAddon: FitAddon) {
  try {
    fitAddon.fit();
  } catch {
    // Renderer not ready yet — will fit on next resize
  }
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: TerminalOptions = {},
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Delay initial fit — renderer needs one frame after open() to initialize
    const rafId = requestAnimationFrame(() => safeFit(fitAddon));

    // Build WebSocket URL
    const params = new URLSearchParams();
    if (options.cwd) params.set("cwd", options.cwd);
    if (options.initialCommand)
      params.set("initialCommand", options.initialCommand);
    const query = params.toString();
    const protocol =
      window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal${query ? `?${query}` : ""}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }),
      );
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[33m[Connection closed]\x1b[0m\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize handling — ResizeObserver fires immediately on observe(),
    // so safeFit protects against renderer not being ready yet
    const resizeObserver = new ResizeObserver(() => {
      safeFit(fitAddon);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          }),
        );
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [containerRef, options.cwd, options.initialCommand]);
}
