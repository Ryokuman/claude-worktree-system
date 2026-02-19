"use client";

import { useState } from "react";
import type { TerminalSession } from "@/lib/types";

interface TerminalBookmarkBarProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAdd: () => void;
}

export function TerminalBookmarkBar({
  sessions,
  activeSessionId,
  onSelect,
  onClose,
  onRename,
  onAdd,
}: TerminalBookmarkBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleCloseClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const confirmed = confirm(
      "Claude Code가 실행 중일 수 있습니다.\n/exit 후 종료하시겠습니까?",
    );
    if (confirmed) {
      onClose(id);
    }
  }

  function getShortName(name: string): string {
    // Show first 2 chars or number
    const match = name.match(/\d+$/);
    if (match) return match[0];
    return name.slice(0, 2);
  }

  return (
    <div className="terminal-bookmark-bar">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="relative group"
        >
          {editingId === session.id ? (
            <input
              autoFocus
              defaultValue={session.name}
              className="w-[36px] h-[36px] rounded text-center text-[10px] bg-white/10 border border-blue-400/40 text-gray-100 outline-none"
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) onRename(session.id, val);
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          ) : (
            <button
              onClick={() => onSelect(session.id)}
              onDoubleClick={() => setEditingId(session.id)}
              className={`terminal-bookmark ${activeSessionId === session.id ? "active" : ""}`}
              title={session.name}
            >
              {getShortName(session.name)}
            </button>
          )}
          {/* Close button on hover */}
          <button
            onClick={(e) => handleCloseClick(e, session.id)}
            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-gray-700 text-gray-400 text-[8px] items-center justify-center hidden group-hover:flex hover:bg-red-500/60 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>
      ))}

      {/* Add terminal button */}
      <button
        onClick={onAdd}
        className="terminal-bookmark hover:bg-white/10 text-gray-500 hover:text-gray-300 mt-1"
        title="새 터미널"
      >
        +
      </button>
    </div>
  );
}
