"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { WorktreeCardCompact } from "@/components/dashboard/WorktreeCardCompact";
import { AddWorktreeDialog } from "@/components/dashboard/AddWorktreeDialog";
import type { ActiveWorktree, DeactiveBranch } from "@/lib/types";

const WorktreePanel = dynamic(
  () =>
    import("@/components/dashboard/WorktreePanel").then(
      (mod) => mod.WorktreePanel,
    ),
  { ssr: false },
);

const SettingsPanel = dynamic(
  () =>
    import("@/components/settings/SettingsPanel").then(
      (mod) => mod.SettingsPanel,
    ),
  { ssr: false },
);

export default function DashboardPage() {
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [deactive, setDeactive] = useState<DeactiveBranch[]>([]);
  const [mainBranches, setMainBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [selectedTaskNo, setSelectedTaskNo] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  // Track which panels have been opened (persist across selection changes)
  const [openedPanels, setOpenedPanels] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);

  const mainSet = useMemo(() => new Set(mainBranches), [mainBranches]);
  const deactiveCount = useMemo(
    () => deactive.filter((d) => !mainSet.has(d.branch)).length,
    [deactive, mainSet],
  );
  const totalBranches = active.length + deactiveCount;

  const activeTaskNos = useMemo(
    () => new Set(active.map((w) => w.taskNo)),
    [active],
  );

  // Clean up opened panels for worktrees that no longer exist (completed/removed)
  useEffect(() => {
    setOpenedPanels((prev) => {
      const next = new Set<string>();
      for (const taskNo of prev) {
        if (activeTaskNos.has(taskNo)) next.add(taskNo);
      }
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [activeTaskNos]);

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

  const handleHealthCheck = useCallback(async () => {
    setHealthChecking(true);
    try {
      await fetch("/api/health-check", { method: "POST" });
      await fetchStatus();
    } finally {
      setHealthChecking(false);
    }
  }, [fetchStatus]);

  function selectWorktree(taskNo: string) {
    setShowSettings(false);
    setSelectedTaskNo(taskNo);
    setOpenedPanels((prev) => {
      if (prev.has(taskNo)) return prev;
      const next = new Set(prev);
      next.add(taskNo);
      return next;
    });
    requestAnimationFrame(() => setPanelVisible(true));
  }

  function openSettings() {
    setShowSettings(true);
    setSettingsMounted(true);
    setPanelVisible(false);
  }

  function closeSettings() {
    setShowSettings(false);
    // If no worktree was selected, go back to grid view
    if (!selectedTaskNo) return;
    // Otherwise show the previously selected worktree panel
    requestAnimationFrame(() => setPanelVisible(true));
  }

  function closePanel() {
    setPanelVisible(false);
    setTimeout(() => setSelectedTaskNo(null), 300);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showSettings) {
          closeSettings();
        } else if (selectedTaskNo) {
          closePanel();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskNo, showSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const hasView = selectedTaskNo !== null || showSettings;

  // ── No selection & no settings: centered grid layout ──
  if (!hasView) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Wide header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-100">Worktree Handler</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="relative group cursor-default">
                branch{" "}
                <span className="font-mono text-gray-300">{totalBranches}</span>
                <span className="absolute left-0 top-full mt-1 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded glass-modal px-2.5 py-1.5 text-xs shadow-2xl z-10">
                  <span className="text-green-400">
                    active <span className="font-mono">{active.length}</span>
                  </span>
                  <span className="text-red-400">
                    deactivated{" "}
                    <span className="font-mono">{deactiveCount}</span>
                  </span>
                </span>
              </span>
              {mainBranches.length > 0 && (
                <span>
                  main{" "}
                  <span className="font-mono text-gray-300">
                    {mainBranches.length}
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleHealthCheck}
              disabled={healthChecking}
              className="glass-button rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50"
              title="Sync server status with actual ports"
            >
              {healthChecking ? "Checking..." : "Server Refresh"}
            </button>
            <button
              onClick={handleRefreshGit}
              disabled={refreshing}
              className="glass-button rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh Git"}
            </button>
          </div>
        </div>

        {active.length === 0 ? (
          <div className="glass-card rounded-lg p-8 text-center text-gray-500">
            No active worktrees. Click [+ Add] to create one.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {active.map((wt) => (
              <WorktreeCardCompact
                key={wt.taskNo}
                worktree={wt}
                selected={false}
                onSelect={selectWorktree}
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
          <div className="flex items-center gap-3">
            <button
              onClick={openSettings}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Settings
            </button>
            <Link
              href="/ended"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Ended
            </Link>
          </div>
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

  // ── Has selection: sidebar + panel layout ──
  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <aside className="dashboard-sidebar flex flex-col">
        {/* Sidebar header — stacked vertically for narrow width */}
        <div className="px-4 pt-4 pb-3 border-b border-white/6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-bold text-gray-100">
              Worktree Handler
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleHealthCheck}
                disabled={healthChecking}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                title="Server Refresh"
              >
                {healthChecking ? "..." : "⟳"}
              </button>
              <button
                onClick={handleRefreshGit}
                disabled={refreshing}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                title="Refresh Git"
              >
                {refreshing ? "..." : "↻"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="relative group cursor-default">
              branch{" "}
              <span className="font-mono text-gray-300">{totalBranches}</span>
              <span className="absolute left-0 top-full mt-1 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded glass-modal px-2.5 py-1.5 text-xs shadow-2xl z-50">
                <span className="text-green-400">
                  active <span className="font-mono">{active.length}</span>
                </span>
                <span className="text-red-400">
                  deactivated{" "}
                  <span className="font-mono">{deactiveCount}</span>
                </span>
              </span>
            </span>
            {mainBranches.length > 0 && (
              <span>
                main{" "}
                <span className="font-mono text-gray-300">
                  {mainBranches.length}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Card list */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-3">
          {active.map((wt) => (
            <WorktreeCardCompact
              key={wt.taskNo}
              worktree={wt}
              selected={wt.taskNo === selectedTaskNo}
              onSelect={selectWorktree}
            />
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
          <button
            onClick={() => setShowAddDialog(true)}
            className="glass-button-primary rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          >
            + Add
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={openSettings}
              className={`text-xs transition-colors ${
                showSettings
                  ? "text-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              title="Settings"
            >
              Settings
            </button>
            <Link
              href="/ended"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Ended
            </Link>
          </div>
        </div>
      </aside>

      {/* Right Panel — all opened panels rendered, only selected is visible */}
      <main className="flex-1 overflow-hidden relative">
        {/* Settings Panel — mounted once, hidden when not active */}
        {settingsMounted && (
          <div
            className="absolute inset-0 h-full"
            style={{ display: showSettings ? "block" : "none" }}
          >
            <SettingsPanel onClose={closeSettings} />
          </div>
        )}

        {/* Worktree Panels */}
        {Array.from(openedPanels).map((taskNo) => {
          const wt = active.find((w) => w.taskNo === taskNo);
          if (!wt) return null;
          const isVisible = taskNo === selectedTaskNo && panelVisible && !showSettings;
          return (
            <div
              key={taskNo}
              className={`absolute inset-0 panel-container h-full ${isVisible ? "visible" : ""}`}
              style={{ display: isVisible ? "block" : "none" }}
            >
              <WorktreePanel
                worktree={wt}
                onClose={closePanel}
                onRefresh={fetchStatus}
              />
            </div>
          );
        })}
      </main>

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
