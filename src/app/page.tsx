"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { WorktreeCard } from "@/components/dashboard/WorktreeCard";
import { AddWorktreeDialog } from "@/components/dashboard/AddWorktreeDialog";
import type { ActiveWorktree, DeactiveBranch } from "@/lib/types";

export default function DashboardPage() {
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [deactive, setDeactive] = useState<DeactiveBranch[]>([]);
  const [mainBranches, setMainBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mainSet = useMemo(() => new Set(mainBranches), [mainBranches]);

  const deactiveCount = useMemo(
    () => deactive.filter((d) => !mainSet.has(d.branch)).length,
    [deactive, mainSet],
  );
  const totalBranches = active.length + deactiveCount;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setActive(data.active);
      setDeactive(data.deactive);
      setMainBranches(data.mainBranches || []);
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
            <span className="relative group cursor-default">
              branch <span className="font-mono text-gray-300">{totalBranches}</span>
              <span className="absolute left-0 top-full mt-1 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded glass-modal px-2.5 py-1.5 text-xs shadow-2xl z-10">
                <span className="text-green-400">active <span className="font-mono">{active.length}</span></span>
                <span className="text-red-400">deactivated <span className="font-mono">{deactiveCount}</span></span>
              </span>
            </span>
            {mainBranches.length > 0 && (
              <span>
                main <span className="font-mono text-gray-300">{mainBranches.length}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleRefreshGit}
          disabled={refreshing}
          className="glass-button rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh Git"}
        </button>
      </header>

      {active.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center text-gray-500">
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
          className="glass-button-primary rounded-lg px-4 py-2 text-sm font-medium text-white"
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
          <span className="inline-block h-2 w-2 rounded-full bg-green-400 glass-status-glow mr-1" />
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
          mainBranches={mainBranches}
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
