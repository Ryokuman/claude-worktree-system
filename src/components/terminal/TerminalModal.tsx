"use client";

import { useState, useEffect } from "react";
import { XTerminal } from "./XTerminal";

interface TerminalModalProps {
  branch: string;
  onClose: () => void;
}

export function TerminalModal({ branch, onClose }: TerminalModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function createSession() {
      try {
        const res = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cwd: process.env.NEXT_PUBLIC_MAIN_REPO_PATH || "/tmp" }),
        });
        if (!res.ok) throw new Error("Failed to create terminal session");
        const data = await res.json();
        setSessionId(data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
    createSession();
  }, [branch]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-sm text-gray-300 font-mono">
          Terminal - {branch}
        </span>
        <button
          onClick={onClose}
          className="rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
        >
          Close & Create Worktree
        </button>
      </div>
      <div className="flex-1 p-1">
        {error && (
          <div className="p-4 text-red-400 text-sm">Error: {error}</div>
        )}
        {sessionId && <XTerminal sessionId={sessionId} />}
      </div>
    </div>
  );
}
