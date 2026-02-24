"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ActiveWorktree, PanelTab } from "@/lib/types";
import { PanelTabBar } from "./PanelTabBar";
import { EnvEditorDialog } from "./EnvEditorDialog";
import { TerminalInitDialog } from "./TerminalInitDialog";

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
const LogsTabView = dynamic(
  () => import("@/components/panel/LogsTabView").then((m) => m.LogsTabView),
  { ssr: false },
);

const STARTING_TIMEOUT_MS = 60_000; // 1분

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
  const [showInit, setShowInit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const serverPendingRef = useRef(false);
  const [terminalMounted, setTerminalMounted] = useState(false);

  // ── 1분 타임아웃 다이얼로그 ──
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const startingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRunning = worktree.status === "running";
  const isStarting = worktree.status === "starting";

  const scheduleTimeout = useCallback(() => {
    if (startingTimerRef.current) clearTimeout(startingTimerRef.current);
    startingTimerRef.current = setTimeout(() => {
      setShowTimeoutDialog(true);
    }, STARTING_TIMEOUT_MS);
  }, []);

  // starting 상태 감시: 1분 후 타임아웃 다이얼로그
  useEffect(() => {
    if (isStarting) {
      scheduleTimeout();
    } else {
      // starting 아니면 타이머 + 다이얼로그 리셋
      setShowTimeoutDialog(false);
      if (startingTimerRef.current) {
        clearTimeout(startingTimerRef.current);
        startingTimerRef.current = null;
      }
    }
    return () => {
      if (startingTimerRef.current) clearTimeout(startingTimerRef.current);
    };
  }, [isStarting, scheduleTimeout]);

  async function handleKeepSession() {
    setShowTimeoutDialog(false);
    // 1분 더 기다림
    scheduleTimeout();
  }

  async function handleKillSession() {
    setShowTimeoutDialog(false);
    await fetch(`/api/worktrees/${worktree.taskNo}/stop`, { method: "POST" });
    onRefresh();
  }

  function handleTabChange(tab: PanelTab) {
    setActiveTab(tab);
    if (tab === "terminal") {
      setTerminalMounted(true);
    }
  }

  async function handleServerToggle() {
    if (isStarting || serverPendingRef.current) return;
    serverPendingRef.current = true;
    setServerLoading(true);
    try {
      const endpoint = isRunning ? "stop" : "start";
      await fetch(`/api/worktrees/${worktree.taskNo}/${endpoint}`, {
        method: "POST",
      });
      onRefresh();
    } finally {
      serverPendingRef.current = false;
      setServerLoading(false);
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
          {isRunning ? (
            <a
              href={`http://localhost:${worktree.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors shrink-0"
              title={`http://localhost:${worktree.port}`}
            >
              {worktree.taskNo}
            </a>
          ) : (
            <span className="font-mono text-sm font-semibold text-gray-400 shrink-0">
              {worktree.taskNo}
            </span>
          )}
          <span className="text-sm text-gray-300 truncate">
            {worktree.taskName}
          </span>
          {/* Server start/stop button */}
          <button
            onClick={handleServerToggle}
            disabled={serverLoading || isStarting}
            className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 transition-all ${
              isRunning
                ? "bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30"
                : isStarting
                  ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
                  : "bg-green-500/20 text-green-300 border border-green-400/30 hover:bg-green-500/30"
            }`}
            title={isRunning ? "Stop server" : isStarting ? "Starting..." : "Start server"}
          >
            {isRunning ? "■ Stop" : isStarting ? "⏳ Starting" : "▶ Start"}
          </button>
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
            onClick={() => setShowInit(true)}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            init
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
            <TerminalTabView cwd={worktree.path} taskNo={worktree.taskNo} />
          )}
        </div>

        {/* Logs Tab */}
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "logs" ? "flex" : "none" }}
        >
          <LogsTabView taskNo={worktree.taskNo} status={worktree.status} />
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

      {showInit && (
        <TerminalInitDialog
          taskNo={worktree.taskNo}
          taskName={worktree.taskName}
          onClose={() => setShowInit(false)}
        />
      )}

      {/* 서버 응답 없음 다이얼로그 */}
      {showTimeoutDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass-modal rounded-xl px-6 py-5 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-sm text-gray-200 mb-4">
              <span className="font-semibold text-yellow-400">
                {worktree.taskName}
              </span>{" "}
              서버가 응답이 없습니다. 세션을 유지할까요?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleKillSession}
                className="rounded px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 transition-colors"
              >
                종료
              </button>
              <button
                onClick={handleKeepSession}
                className="rounded px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30 hover:bg-blue-500/30 transition-colors"
              >
                유지
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
