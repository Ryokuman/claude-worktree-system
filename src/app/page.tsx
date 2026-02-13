"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useWorktrees } from "@/hooks/useWorktrees";
import { WorktreeList } from "@/components/dashboard/WorktreeList";
import { AddWorktreeDialog } from "@/components/dashboard/AddWorktreeDialog";
import dynamic from "next/dynamic";

const TerminalModal = dynamic(
  () =>
    import("@/components/terminal/TerminalModal").then(
      (mod) => mod.TerminalModal
    ),
  { ssr: false }
);

export default function DashboardPage() {
  const { active, deactive, loading, refresh } = useWorktrees();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [terminalBranch, setTerminalBranch] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshGit = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleOpenTerminal = useCallback((branch: string) => {
    setTerminalBranch(branch);
    setShowAddDialog(false);
  }, []);

  const handleTerminalClose = useCallback(async () => {
    if (terminalBranch) {
      // Only create worktree if not already active
      const isAlreadyActive = active.some((w) => w.branch === terminalBranch);
      if (!isAlreadyActive) {
        try {
          await fetch("/api/worktrees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branch: terminalBranch }),
          });
        } catch (err) {
          console.error("Failed to create worktree:", err);
        }
      }
    }
    setTerminalBranch(null);
    refresh();
  }, [terminalBranch, active, refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-100">
          {process.env.NEXT_PUBLIC_PROJECT_NAME} Worktree Handler
        </h1>
        <button
          onClick={handleRefreshGit}
          disabled={refreshing}
          className="rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          {refreshing ? "Refreshing..." : "Refresh Git"}
        </button>
      </header>

      <WorktreeList worktrees={active} onRefresh={refresh} onOpenTerminal={handleOpenTerminal} />

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setShowAddDialog(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          + Add
        </button>
        <Link
          href="/ended"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Ended
        </Link>
      </div>

      <div className="mt-6 text-xs text-gray-600 flex gap-4">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-green-400 mr-1" />
          = running
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-gray-500 mr-1" />
          = stopped
        </span>
      </div>

      {showAddDialog && (
        <AddWorktreeDialog
          branches={deactive}
          onAdd={() => {
            setShowAddDialog(false);
            refresh();
          }}
          onClose={() => setShowAddDialog(false)}
          onOpenTerminal={handleOpenTerminal}
        />
      )}

      {terminalBranch && (
        <TerminalModal
          branch={terminalBranch}
          onClose={handleTerminalClose}
        />
      )}
    </div>
  );
}
