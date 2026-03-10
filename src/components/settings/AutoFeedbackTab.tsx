"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveWorktree } from "@/lib/types";

interface AutoFeedbackConfig {
  enabled: boolean;
  prompt: string;
  perWorktree?: Record<
    string,
    {
      enabled?: boolean;
      prompt?: string;
    }
  >;
}

export function AutoFeedbackTab() {
  const [config, setConfig] = useState<AutoFeedbackConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<AutoFeedbackConfig | null>(null);
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [fbRes, statusRes] = await Promise.all([
        fetch("/api/settings/auto-feedback"),
        fetch("/api/status"),
      ]);
      const fbData: AutoFeedbackConfig = await fbRes.json();
      const statusData = await statusRes.json();
      setConfig(fbData);
      setSavedConfig(fbData);
      setActive(statusData.active || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function isDirty(): boolean {
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }

  function updateConfig(updates: Partial<AutoFeedbackConfig>) {
    if (!config) return;
    setConfig({ ...config, ...updates });
  }

  function updatePerWorktree(
    taskNo: string,
    updates: Partial<{ enabled?: boolean; prompt?: string }>,
  ) {
    if (!config) return;
    setConfig({
      ...config,
      perWorktree: {
        ...config.perWorktree,
        [taskNo]: {
          ...(config.perWorktree?.[taskNo] || {}),
          ...updates,
        },
      },
    });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await fetch("/api/settings/auto-feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const res = await fetch("/api/settings/auto-feedback");
      const data = await res.json();
      setConfig(data);
      setSavedConfig(data);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-5 space-y-6">
      <p className="text-xs text-gray-500">
        When a Claude Code terminal session ends, automatically run a follow-up
        Claude session with the configured prompt.
      </p>

      {/* Global settings */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Global Settings
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-400">
              {config.enabled ? "Enabled" : "Disabled"}
            </span>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                config.enabled ? "bg-blue-500" : "bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.enabled ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </label>
        </div>

        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Feedback Prompt
          </label>
          <textarea
            value={config.prompt}
            onChange={(e) => updateConfig({ prompt: e.target.value })}
            rows={4}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y mt-1"
            placeholder='e.g. "지금까지 대화 내역을 바탕으로 피드백을 작성해줘"'
          />
        </div>
      </section>

      {/* Per-worktree overrides */}
      {active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Per-Worktree Override
          </h3>
          <div className="space-y-4">
            {active.map((wt) => {
              const perWt = config.perWorktree?.[wt.taskNo] || {};
              return (
                <div key={wt.taskNo} className="glass-card rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {wt.taskNo}
                      </span>
                      <span className="text-xs text-gray-400 truncate">
                        {wt.taskName}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        onClick={() =>
                          updatePerWorktree(wt.taskNo, {
                            enabled:
                              perWt.enabled === undefined
                                ? !config.enabled
                                : !perWt.enabled,
                          })
                        }
                        className={`relative w-7 h-4 rounded-full transition-colors ${
                          (perWt.enabled ?? config.enabled)
                            ? "bg-blue-500"
                            : "bg-gray-600"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            (perWt.enabled ?? config.enabled)
                              ? "left-[14px]"
                              : "left-0.5"
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                  <textarea
                    value={perWt.prompt || ""}
                    onChange={(e) =>
                      updatePerWorktree(wt.taskNo, { prompt: e.target.value })
                    }
                    rows={2}
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
                    placeholder="Override prompt (leave empty to use global)"
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isDirty() && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      )}
    </div>
  );
}
