"use client";

import { useRef } from "react";
import { useTerminal } from "./useTerminal";

interface XTerminalProps {
  sessionId: string;
}

export function XTerminal({ sessionId }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, { sessionId });

  return <div ref={containerRef} className="h-full w-full" />;
}
