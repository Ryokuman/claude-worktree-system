"use client";

import type { ActiveWorktree } from "@/lib/types";

interface WorktreeCardCompactProps {
  worktree: ActiveWorktree;
  selected: boolean;
  onSelect: (taskNo: string) => void;
}

export function WorktreeCardCompact({
  worktree,
  selected,
  onSelect,
}: WorktreeCardCompactProps) {
  const isRunning = worktree.status === "running";
  const isStarting = worktree.status === "starting";

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
        <span
          className={`h-1.5 w-1.5 rounded-full ${isRunning ? "bg-green-400 animate-pulse" : isStarting ? "bg-yellow-400 animate-pulse" : "bg-gray-600"}`}
        />
      </div>
      <span className="text-sm text-gray-300 truncate">{worktree.taskName}</span>
      <span className="text-[10px] text-gray-600 font-mono mt-1">
        :{worktree.port}
      </span>
    </div>
  );
}
