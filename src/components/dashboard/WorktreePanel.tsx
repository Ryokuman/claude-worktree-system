"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ActiveWorktree, PanelTab } from "@/lib/types";
import { PanelTabBar } from "./PanelTabBar";
import { EnvEditorDialog } from "./EnvEditorDialog";

const PlanTabView = dynamic(
  () => import("@/components/panel/PlanTabView").then((m) => m.PlanTabView),
  { ssr: false },
);
const TerminalTabView = dynamic(
  () =>
    import("@/components/panel/TerminalTabView").then(
      (m) => m.TerminalTabView,
    ),
  { ssr: false },
);
const TasksTabView = dynamic(
  () => import("@/components/panel/TasksTabView").then((m) => m.TasksTabView),
  { ssr: false },
);
const GitTabView = dynamic(
  () => import("@/components/panel/GitTabView").then((m) => m.GitTabView),
  { ssr: false },
);

interface WorktreePanelProps {
  worktree: ActiveWorktree;
  onClose: () => void;
  onRefresh: () => void;
}

export function WorktreePanel({
  worktree,
  onClose,
  onRefresh,
}: WorktreePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("plan");
  const [showEnv, setShowEnv] = useState(false);
  const [loading, setLoading] = useState(false);
  // Track whether terminal tab has been opened at least once
  const [terminalMounted, setTerminalMounted] = useState(false);

  function handleTabChange(tab: PanelTab) {
    setActiveTab(tab);
    if (tab === "terminal") {
      setTerminalMounted(true);
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
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-3 min-w-0">
          {worktree.status === "running" ? (
            <a
              href={`http://localhost:${worktree.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              title={`http://localhost:${worktree.port}`}
            >
              {worktree.taskNo}
            </a>
          ) : (
            <span className="font-mono text-sm font-semibold text-gray-400">
              {worktree.taskNo}
            </span>
          )}
          <span className="text-sm text-gray-300 truncate">
            {worktree.taskName}
          </span>
          {worktree.status === "running" && (
            <span className="flex items-center gap-1.5 text-[10px] text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              await fetch(`/api/worktrees/${worktree.taskNo}/vscode`, {
                method: "POST",
              });
            }}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
            title="Open in VSCode"
          >
            code
          </button>
          <button
            onClick={() => setShowEnv(true)}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            env
          </button>
          <button
            onClick={handleComplete}
            disabled={loading}
            className="glass-button rounded px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-100 disabled:opacity-50"
          >
            완료
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-2"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <PanelTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Plan Tab */}
        <div
          className="absolute inset-0 overflow-auto"
          style={{ display: activeTab === "plan" ? "block" : "none" }}
        >
          <PlanTabView branch={worktree.branch} worktreePath={worktree.path} />
        </div>

        {/* Terminal Tab - always mounted once opened to preserve sessions */}
        <div
          className="absolute inset-0"
          style={{
            display: activeTab === "terminal" ? "flex" : "none",
          }}
        >
          {terminalMounted && (
            <TerminalTabView cwd={worktree.path} />
          )}
        </div>

        {/* Tasks Tab */}
        <div
          className="absolute inset-0 overflow-auto"
          style={{ display: activeTab === "tasks" ? "block" : "none" }}
        >
          <TasksTabView branch={worktree.branch} />
        </div>

        {/* Git Tab */}
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "git" ? "flex" : "none" }}
        >
          <GitTabView branch={worktree.branch} />
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
