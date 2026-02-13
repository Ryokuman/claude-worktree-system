"use client";

import type { ActiveWorktree } from "@/lib/types";
import { WorktreeCard } from "./WorktreeCard";

interface WorktreeListProps {
  worktrees: ActiveWorktree[];
  onRefresh: () => void;
  onOpenTerminal: (branch: string) => void;
}

export function WorktreeList({ worktrees, onRefresh, onOpenTerminal }: WorktreeListProps) {
  if (worktrees.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500">
        No active worktrees. Click [+ Add] to create one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {worktrees.map((wt) => (
        <WorktreeCard key={wt.taskNo} worktree={wt} onRefresh={onRefresh} onOpenTerminal={onOpenTerminal} />
      ))}
    </div>
  );
}
