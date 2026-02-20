"use client";

import { useRef, useEffect, useState } from "react";
import { useLogViewer } from "@/components/terminal/useLogViewer";

interface LogsTabViewProps {
  taskNo: string;
  status: "running" | "stopped";
}

export function LogsTabView({ taskNo, status }: LogsTabViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { refit, clear, noLogFile } = useLogViewer(containerRef, taskNo);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(refit, 50);
    return () => clearTimeout(timer);
  }, [refit]);

  async function handleRestart() {
    setRestarting(true);
    try {
      await fetch(`/api/worktrees/${taskNo}/stop`, { method: "POST" });
      // Brief pause for process cleanup
      await new Promise((r) => setTimeout(r, 1000));
      await fetch(`/api/worktrees/${taskNo}/start`, { method: "POST" });
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-mono">
            Server Logs
          </span>
          {status === "running" ? (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              streaming
            </span>
          ) : (
            <span className="text-[10px] text-gray-600">stopped</span>
          )}
        </div>
        <button
          onClick={clear}
          className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* No log file overlay */}
      {noLogFile && status === "running" && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 border-b border-white/6">
          <p className="text-xs text-gray-500">
            이 서버는 로그 캡처 전에 시작되어 로그를 볼 수 없습니다.
          </p>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="glass-button rounded px-4 py-1.5 text-xs font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50"
          >
            {restarting ? "재시작 중..." : "서버 재시작하여 로그 활성화"}
          </button>
        </div>
      )}

      {/* xterm container */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
