"use client";

import { useState, useCallback } from "react";
import type { TerminalSession } from "@/lib/types";
import { TerminalInstance } from "@/components/terminal/TerminalInstance";
import { TerminalBookmarkBar } from "./TerminalBookmarkBar";

interface TerminalTabViewProps {
  cwd: string;
  taskNo?: string;
}

let sessionCounter = 0;

function createSession(name?: string): TerminalSession {
  sessionCounter++;
  return {
    id: `term-${Date.now()}-${sessionCounter}`,
    name: name ?? `Terminal ${sessionCounter}`,
    createdAt: Date.now(),
  };
}

export function TerminalTabView({ cwd, taskNo }: TerminalTabViewProps) {
  // Create initial session synchronously to avoid empty-state flash
  const [sessions, setSessions] = useState<TerminalSession[]>(() => {
    const first = createSession();
    return [first];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => sessions[0]?.id ?? null,
  );

  const handleAdd = useCallback(() => {
    const newSession = createSession();
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  }, []);

  const handleClose = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          setActiveSessionId(
            next.length > 0 ? next[next.length - 1].id : null,
          );
        }
        return next;
      });
    },
    [activeSessionId],
  );

  const handleRename = useCallback((id: string, name: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s)),
    );
  }, []);

  const handleSelect = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <button
          onClick={handleAdd}
          className="glass-button-primary rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          + 새 터미널
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      {/* Terminal area */}
      <div className="flex-1 min-w-0 h-full">
        {sessions.map((session) => (
          <TerminalInstance
            key={session.id}
            sessionId={session.id}
            cwd={cwd}
            visible={session.id === activeSessionId}
            taskNo={taskNo}
          />
        ))}
      </div>

      {/* Bookmark sidebar */}
      <TerminalBookmarkBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={handleSelect}
        onClose={handleClose}
        onRename={handleRename}
        onAdd={handleAdd}
      />
    </div>
  );
}
