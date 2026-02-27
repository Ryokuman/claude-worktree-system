"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveWorktree } from "@/lib/types";

interface PermissionsData {
  default: string[];
  [taskNo: string]: string[];
}

const PRESETS: { label: string; rules: string[] }[] = [
  {
    label: "Git",
    rules: [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git pull:*)",
      "Bash(git diff:*)",
      "Bash(git branch:*)",
      "Bash(git reset:*)",
      "Bash(gh:*)",
    ],
  },
  {
    label: "NPM",
    rules: [
      "Bash(npm install:*)",
      "Bash(npm run build:*)",
      "Bash(npm run dev:*)",
      "Bash(npm test:*)",
      "Bash(npx:*)",
    ],
  },
  {
    label: "Web",
    rules: [
      "WebSearch",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:www.npmjs.com)",
    ],
  },
  {
    label: "Tools",
    rules: [
      "Read",
      "Edit",
      "Glob",
      "Grep",
    ],
  },
  {
    label: "System",
    rules: [
      "Bash(ls:*)",
      "Bash(ps:*)",
      "Bash(kill:*)",
      "Bash(lsof:*)",
      "Bash(curl:*)",
    ],
  },
];

export function ClaudeCodeTab() {
  const [data, setData] = useState<PermissionsData>({ default: [] });
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editBuffers, setEditBuffers] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/claude-permissions");
      const result = await res.json();
      const perms: PermissionsData = result.permissions || { default: [] };
      setData(perms);
      setActive(result.active || []);

      const buffers: Record<string, string> = {
        default: (perms.default || []).join("\n"),
      };
      for (const wt of result.active || []) {
        buffers[wt.taskNo] = (perms[wt.taskNo] || []).join("\n");
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
    const rules = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    setSaving(taskNo);
    try {
      await fetch("/api/settings/claude-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskNo: key, rules }),
      });
      const res = await fetch("/api/settings/claude-permissions");
      const result = await res.json();
      setData(result.permissions || { default: [] });
    } finally {
      setSaving(null);
    }
  }

  function handleChange(taskNo: string, value: string) {
    setEditBuffers((prev) => ({ ...prev, [taskNo]: value }));
  }

  function addPreset(taskNo: string, rules: string[]) {
    setEditBuffers((prev) => {
      const current = prev[taskNo] || "";
      const existing = new Set(
        current
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      );
      const newRules = rules.filter((r) => !existing.has(r));
      if (newRules.length === 0) return prev;
      const appended = current ? `${current}\n${newRules.join("\n")}` : newRules.join("\n");
      return { ...prev, [taskNo]: appended };
    });
  }

  function isDirty(taskNo: string): boolean {
    const current = (data[taskNo] || []).join("\n");
    return (editBuffers[taskNo] || "") !== current;
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-5 space-y-6">
      <p className="text-xs text-gray-500">
        Claude Code 권한 규칙을 설정합니다. 저장 시 대상 워크트리의
        .claude/settings.local.json에 자동 적용됩니다.
      </p>

      {/* Default permissions */}
      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
          Default (all worktrees)
        </h3>

        {/* Preset buttons */}
        <div className="flex gap-1.5 mb-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => addPreset("default", p.rules)}
              className="glass-button rounded px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200"
            >
              + {p.label}
            </button>
          ))}
        </div>

        <textarea
          value={editBuffers["default"] || ""}
          onChange={(e) => handleChange("default", e.target.value)}
          rows={6}
          className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
          placeholder={'Bash(git add:*)\nBash(npm install:*)\nWebSearch'}
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

      {/* Per-worktree permissions */}
      {active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Per-Worktree
          </h3>
          <div className="space-y-4">
            {active.map((wt) => (
              <div key={wt.taskNo} className="glass-card rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold text-blue-400">
                    {wt.taskNo}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {wt.taskName}
                  </span>
                </div>

                <div className="flex gap-1.5 mb-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => addPreset(wt.taskNo, p.rules)}
                      className="glass-button rounded px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={editBuffers[wt.taskNo] || ""}
                  onChange={(e) => handleChange(wt.taskNo, e.target.value)}
                  rows={3}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
                  placeholder="Additional permission rules for this worktree..."
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
