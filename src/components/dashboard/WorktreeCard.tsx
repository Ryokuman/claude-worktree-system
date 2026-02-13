"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActiveWorktree } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface WorktreeCardProps {
  worktree: ActiveWorktree;
  onRefresh: () => void;
  onOpenTerminal: (branch: string) => void;
}

export function WorktreeCard({ worktree, onRefresh, onOpenTerminal }: WorktreeCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await fetch(`/api/worktrees/${worktree.taskNo}/start`, { method: "POST" });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    try {
      await fetch(`/api/worktrees/${worktree.taskNo}/stop`, { method: "POST" });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!confirm(`"${worktree.taskNo} ${worktree.taskName}" 작업을 완료 처리하시겠습니까?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/worktrees/${worktree.taskNo}/complete`, { method: "POST" });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        {worktree.status === "running" ? (
          <a
            href={`http://localhost:${worktree.port}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap"
          >
            {worktree.taskNo}
          </a>
        ) : (
          <span className="font-mono text-sm font-semibold text-gray-400 whitespace-nowrap">
            {worktree.taskNo}
          </span>
        )}
        <span className="text-sm text-gray-300 truncate">{worktree.taskName}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Plan: show link or create button */}
        {worktree.hasPlan ? (
          <Link
            href={`/plan/${encodeURIComponent(worktree.branch)}`}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            plan
          </Link>
        ) : (
          <button
            onClick={() => onOpenTerminal(worktree.branch)}
            className="rounded px-2 py-1 text-xs font-medium bg-purple-900/50 text-purple-400 hover:bg-purple-900 transition-colors"
          >
            + plan
          </button>
        )}

        <StatusBadge status={worktree.status} />

        <div className="flex items-center gap-1">
          {worktree.status === "stopped" ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="rounded px-2 py-1 text-xs font-medium bg-green-900/50 text-green-400 hover:bg-green-900 disabled:opacity-50 transition-colors"
              title="Start dev server"
            >
              ▶
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="rounded px-2 py-1 text-xs font-medium bg-red-900/50 text-red-400 hover:bg-red-900 disabled:opacity-50 transition-colors"
              title="Stop dev server"
            >
              ■
            </button>
          )}
          <button
            onClick={handleComplete}
            disabled={loading}
            className="rounded px-2 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50 transition-colors"
            title="Mark as completed"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
