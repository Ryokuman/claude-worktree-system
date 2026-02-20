"use client";

import { useState, useRef } from "react";
import type { ActiveWorktree } from "@/lib/types";

interface WorktreeCardCompactProps {
  worktree: ActiveWorktree;
  selected: boolean;
  onSelect: (taskNo: string) => void;
  onRefresh: () => void;
}

export function WorktreeCardCompact({
  worktree,
  selected,
  onSelect,
  onRefresh,
}: WorktreeCardCompactProps) {
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef(false);

  const isRunning = worktree.status === "running";
  const isInstalling = worktree.status === "installing";

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isInstalling || pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    try {
      const endpoint = isRunning ? "stop" : "start";
      await fetch(`/api/worktrees/${worktree.taskNo}/${endpoint}`, {
        method: "POST",
      });
      onRefresh();
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  const cardClass = [
    "worktree-card-compact",
    "rounded-lg p-4 flex flex-col gap-2",
    selected ? "selected" : "",
    isRunning ? "running" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} onClick={() => onSelect(worktree.taskNo)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-gray-400">
          {worktree.taskNo}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isRunning ? "bg-green-400 animate-pulse" : isInstalling ? "bg-yellow-400 animate-pulse" : "bg-gray-600"}`}
          />
        </span>
      </div>
      <span className="text-sm text-gray-300 truncate">{worktree.taskName}</span>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-600 font-mono">
          :{worktree.port}
        </span>
        <button
          onClick={handleToggle}
          disabled={loading || isInstalling}
          className={`rounded px-2 py-0.5 text-[10px] font-medium disabled:opacity-50 transition-all ${
            isRunning
              ? "bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30"
              : isInstalling
                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
                : "bg-green-500/20 text-green-300 border border-green-400/30 hover:bg-green-500/30"
          }`}
          title={isRunning ? "Stop" : isInstalling ? "Installing..." : "Start"}
        >
          {isRunning ? "■" : isInstalling ? "⏳" : "▶"}
        </button>
      </div>
    </div>
  );
}
