"use client";

import { useRef, useEffect } from "react";
import { useTerminal, type TerminalOptions } from "./useTerminal";

interface TerminalInstanceProps {
  sessionId: string;
  cwd: string;
  visible: boolean;
}

export function TerminalInstance({
  sessionId,
  cwd,
  visible,
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { refit } = useTerminal(containerRef, { cwd });

  // Refit when becoming visible
  useEffect(() => {
    if (visible) {
      // Small delay to ensure DOM has correct dimensions
      const timer = setTimeout(() => refit(), 50);
      return () => clearTimeout(timer);
    }
  }, [visible, refit]);

  return (
    <div
      data-session-id={sessionId}
      className="h-full w-full"
      style={{ display: visible ? "block" : "none" }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
