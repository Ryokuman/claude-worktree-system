"use client";

import { useRef } from "react";
import { useTerminal } from "./useTerminal";

interface ResizableTerminalProps {
  sessionId: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  storageKey?: string;
}

function getStoredSize(key: string, fallback: { width: number; height: number }) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return fallback;
}

export function ResizableTerminal({
  sessionId,
  defaultWidth = 800,
  defaultHeight = 400,
  minWidth = 400,
  minHeight = 200,
  storageKey,
}: ResizableTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, { sessionId });

  const initial = storageKey
    ? getStoredSize(storageKey, { width: defaultWidth, height: defaultHeight })
    : { width: defaultWidth, height: defaultHeight };

  const handleMouseUp = () => {
    if (!storageKey || !wrapperRef.current) return;
    const el = wrapperRef.current;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ width: el.offsetWidth, height: el.offsetHeight }),
    );
  };

  return (
    <div
      ref={wrapperRef}
      onMouseUp={handleMouseUp}
      style={{
        width: initial.width,
        height: initial.height,
        resize: "both",
        overflow: "hidden",
        minWidth,
        minHeight,
      }}
      className="rounded-lg border border-gray-800 bg-[#0a0a0a]"
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
