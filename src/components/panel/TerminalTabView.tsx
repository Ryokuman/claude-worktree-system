"use client";

import { useState, useCallback, useEffect } from "react";
import type { TerminalSession } from "@/lib/types";
import { TerminalInstance } from "@/components/terminal/TerminalInstance";
import { TerminalBookmarkBar } from "./TerminalBookmarkBar";

interface TerminalTabViewProps {
  cwd: string;
  taskNo?: string;
}

let sessionCounter = 0;

function createLocalSession(name?: string): TerminalSession {
  sessionCounter++;
  return {
    id: `term-${Date.now()}-${sessionCounter}`,
    name: name ?? `Terminal ${sessionCounter}`,
    createdAt: Date.now(),
  };
}

export function TerminalTabView({ cwd, taskNo }: TerminalTabViewProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // On mount: try to restore existing sessions from server
  useEffect(() => {
    if (!taskNo) {
      // No taskNo — create a local session immediately
      const first = createLocalSession();
      setSessions([first]);
      setActiveSessionId(first.id);
      setRestored(true);
      return;
    }

    let cancelled = false;

    async function restore() {
      try {
        const res = await fetch(`/api/terminal-sessions?taskNo=${taskNo}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const serverSessions: { sessionId: string; name: string | null; alive: boolean }[] =
          data.sessions ?? [];

        if (cancelled) return;

        // Filter to alive sessions only
        const aliveSessions = serverSessions.filter((s) => s.alive);

        if (aliveSessions.length > 0) {
          // Restore from server
          const restored: TerminalSession[] = aliveSessions.map((s, i) => ({
            id: s.sessionId,
            name: s.name ?? `Terminal ${i + 1}`,
            createdAt: Date.now(),
          }));
          setSessions(restored);
          setActiveSessionId(restored[0].id);
        } else {
          // No existing sessions — create new
          const first = createLocalSession();
          setSessions([first]);
          setActiveSessionId(first.id);
        }
      } catch {
        // API error — create new session
        if (!cancelled) {
          const first = createLocalSession();
          setSessions([first]);
          setActiveSessionId(first.id);
        }
      }
      if (!cancelled) setRestored(true);
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [taskNo]);

  const handleAdd = useCallback(() => {
    const newSession = createLocalSession();
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

  // Show nothing until restore attempt completes (prevents flash)
  if (!restored) {
    return null;
  }

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
            sessionName={session.name}
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
