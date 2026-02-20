"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { ActiveWorktree } from "@/lib/types";
import { EnvEditorDialog } from "./EnvEditorDialog";

interface WorktreeCardProps {
  worktree: ActiveWorktree;
  onRefresh: () => void;
}

export function WorktreeCard({ worktree, onRefresh }: WorktreeCardProps) {
  const [loading, setLoading] = useState(false);
  const [showEnv, setShowEnv] = useState(false);
  const pendingRef = useRef(false);

  async function handleStart() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    try {
      await fetch(`/api/worktrees/${worktree.taskNo}/start`, {
        method: "POST",
      });
      onRefresh();
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  async function handleStop() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    try {
      await fetch(`/api/worktrees/${worktree.taskNo}/stop`, { method: "POST" });
      onRefresh();
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (
      !confirm(
        `"${worktree.taskNo} ${worktree.taskName}" 작업을 완료 처리하시겠습니까?`,
      )
    )
      return;
    setLoading(true);
    try {
      await fetch(`/api/worktrees/${worktree.taskNo}/complete`, {
        method: "POST",
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card-hover flex items-center justify-between rounded-lg px-4 py-3">
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
        <span className="text-sm text-gray-300 truncate">
          {worktree.taskName}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setShowEnv(true)}
          className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          title="Edit .env"
        >
          env
        </button>

        {worktree.hasPlan ? (
          <Link
            href={`/plan/${encodeURIComponent(worktree.branch)}`}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            plan
          </Link>
        ) : (
          <Link
            href={`/plan/${encodeURIComponent(worktree.branch)}`}
            className="rounded px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-400/30 hover:bg-purple-500/30 hover:border-purple-400/50 backdrop-blur-sm transition-all"
          >
            + plan
          </Link>
        )}

        {worktree.status === "running" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse glass-status-glow" />
            running
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="h-2 w-2 rounded-full bg-gray-500" />
            stopped
          </span>
        )}

        <div className="flex items-center gap-1">
          {worktree.status === "stopped" ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="rounded px-2 py-1 text-xs font-medium bg-green-500/20 text-green-300 border border-green-400/30 hover:bg-green-500/30 hover:border-green-400/50 backdrop-blur-sm disabled:opacity-50 transition-all"
              title="Start dev server"
            >
              ▶
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="rounded px-2 py-1 text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 hover:border-red-400/50 backdrop-blur-sm disabled:opacity-50 transition-all"
              title="Stop dev server"
            >
              ■
            </button>
          )}
          <button
            onClick={handleComplete}
            disabled={loading}
            className="glass-button rounded px-2 py-1 text-xs font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50"
            title="Mark as completed"
          >
            완료
          </button>
        </div>
      </div>
    {showEnv && (
      <EnvEditorDialog
        taskNo={worktree.taskNo}
        taskName={worktree.taskName}
        onClose={() => setShowEnv(false)}
      />
    )}
    </div>
  );
}
