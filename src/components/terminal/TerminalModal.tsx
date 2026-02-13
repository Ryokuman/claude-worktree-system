"use client";

import { useState, useEffect, useRef } from "react";
import { useTerminal } from "./useTerminal";

interface TerminalModalProps {
  title: string;
  cwd: string;
  initialCommand?: string;
  closeLabel?: string;
  onClose: () => void;
}

function TerminalMount({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, { sessionId });
  return <div ref={containerRef} className="h-full w-full" />;
}

export function TerminalModal({
  title,
  cwd,
  initialCommand,
  closeLabel = "Close",
  onClose,
}: TerminalModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function createSession() {
      try {
        const res = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cwd, initialCommand }),
        });
        if (!res.ok) throw new Error("Failed to create terminal session");
        const data = await res.json();
        setSessionId(data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
    createSession();
  }, [cwd, initialCommand]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-sm text-gray-300 font-mono">
          Terminal - {title}
        </span>
        <button
          onClick={onClose}
          className="rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
        >
          {closeLabel}
        </button>
      </div>
      <div className="flex-1 p-1">
        {error && (
          <div className="p-4 text-red-400 text-sm">Error: {error}</div>
        )}
        {sessionId && <TerminalMount sessionId={sessionId} />}
      </div>
    </div>
  );
}
