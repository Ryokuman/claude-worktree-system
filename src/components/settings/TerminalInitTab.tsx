"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveWorktree } from "@/lib/types";

interface InitData {
  default: string[];
  [taskNo: string]: string[];
}

export function TerminalInitTab() {
  const [data, setData] = useState<InitData>({ default: [] });
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editBuffers, setEditBuffers] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [initRes, statusRes] = await Promise.all([
        fetch("/api/settings/terminal-init"),
        fetch("/api/status"),
      ]);
      const initData = await initRes.json();
      const statusData = await statusRes.json();
      setData(initData);
      setActive(statusData.active || []);

      // Initialize edit buffers
      const buffers: Record<string, string> = {
        default: (initData.default || []).join("\n"),
      };
      for (const wt of statusData.active || []) {
        buffers[wt.taskNo] = (initData[wt.taskNo] || []).join("\n");
      }
      setEditBuffers(buffers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave(taskNo: string) {
    const key = taskNo === "default" ? undefined : taskNo;
    const text = editBuffers[taskNo] || "";
    const commands = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    setSaving(taskNo);
    try {
      await fetch("/api/settings/terminal-init", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskNo: key, commands }),
      });
      // Refresh data
      const res = await fetch("/api/settings/terminal-init");
      setData(await res.json());
    } finally {
      setSaving(null);
    }
  }

  function handleChange(taskNo: string, value: string) {
    setEditBuffers((prev) => ({ ...prev, [taskNo]: value }));
  }

  function isDirty(taskNo: string): boolean {
    const current = (data[taskNo] || []).join("\n");
    return (editBuffers[taskNo] || "") !== current;
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="p-5 space-y-6">
      <p className="text-xs text-gray-500">
        Commands to run automatically when a new terminal session is created.
        One command per line.
      </p>

      {/* Default commands */}
      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
          Default (all worktrees)
        </h3>
        <textarea
          value={editBuffers["default"] || ""}
          onChange={(e) => handleChange("default", e.target.value)}
          rows={3}
          className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
          placeholder="ssh-add ~/.ssh/id_ed25519"
        />
        {isDirty("default") && (
          <button
            onClick={() => handleSave("default")}
            disabled={saving === "default"}
            className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white mt-2"
          >
            {saving === "default" ? "Saving..." : "Save"}
          </button>
        )}
      </section>

      {/* Per-worktree commands */}
      {active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Per-Worktree
          </h3>
          <div className="space-y-4">
            {active.map((wt) => (
              <div
                key={wt.taskNo}
                className="glass-card rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold text-blue-400">
                    {wt.taskNo}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {wt.taskName}
                  </span>
                </div>
                <textarea
                  value={editBuffers[wt.taskNo] || ""}
                  onChange={(e) => handleChange(wt.taskNo, e.target.value)}
                  rows={2}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
                  placeholder="Additional init commands for this worktree..."
                />
                {isDirty(wt.taskNo) && (
                  <button
                    onClick={() => handleSave(wt.taskNo)}
                    disabled={saving === wt.taskNo}
                    className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white mt-2"
                  >
                    {saving === wt.taskNo ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
