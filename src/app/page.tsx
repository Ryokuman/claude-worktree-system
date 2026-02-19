"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WorktreeCard } from "@/components/dashboard/WorktreeCard";
import { AddWorktreeDialog } from "@/components/dashboard/AddWorktreeDialog";
import type { ActiveWorktree, DeactiveBranch } from "@/lib/types";

export default function DashboardPage() {
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [deactive, setDeactive] = useState<DeactiveBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setActive(data.active);
      setDeactive(data.deactive);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRefreshGit = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      await fetchStatus();
    } finally {
      setRefreshing(false);
    }
  }, [fetchStatus]);

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
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-100">Worktree Handler</h1>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              active <span className="font-mono text-gray-300">{active.length}</span>
            </span>
            <span>
              branches <span className="font-mono text-gray-300">{deactive.length}</span>
            </span>
          </div>
        </div>
        <button
          onClick={handleRefreshGit}
          disabled={refreshing}
          className="rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          {refreshing ? "Refreshing..." : "Refresh Git"}
        </button>
      </header>

      {active.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500">
          No active worktrees. Click [+ Add] to create one.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((wt) => (
            <WorktreeCard
              key={wt.taskNo}
              worktree={wt}
              onRefresh={fetchStatus}
            />
          ))}
        </div>
      )}

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
            fetchStatus();
          }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}
