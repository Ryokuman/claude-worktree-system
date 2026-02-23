"use client";

import { useRef, useEffect } from "react";
import { useTerminal } from "@/components/terminal/useTerminal";

interface LogsTabViewProps {
  taskNo: string;
  status: "running" | "stopped" | "starting";
}

export function LogsTabView({ taskNo, status }: LogsTabViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { refit } = useTerminal(containerRef, {
    sessionId: `server-${taskNo}`,
    killOnUnmount: false,
    readOnly: true,
  });

  useEffect(() => {
    const timer = setTimeout(refit, 50);
    return () => clearTimeout(timer);
  }, [refit]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center px-3 py-1.5 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-mono">
            Server Logs
          </span>
          {status === "running" ? (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              streaming
            </span>
          ) : status === "starting" ? (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              starting
            </span>
          ) : (
            <span className="text-[10px] text-gray-600">stopped</span>
          )}
        </div>
      </div>

      {/* xterm container */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
