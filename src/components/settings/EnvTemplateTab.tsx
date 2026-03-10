"use client";

import { useState, useEffect, useCallback } from "react";

interface EnvEntry {
  key: string;
  value: string;
}

interface EnvTemplateData {
  source: string | null;
  keys: EnvEntry[];
  overrides: Record<string, string>;
  placeholders: string[];
}

export function EnvTemplateTab() {
  const [data, setData] = useState<EnvTemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editBuffers, setEditBuffers] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/env-template");
      const json: EnvTemplateData = await res.json();
      setData(json);

      // Initialize edit buffers from saved overrides
      const buffers: Record<string, string> = {};
      for (const entry of json.keys) {
        buffers[entry.key] = json.overrides[entry.key] || "";
      }
      setEditBuffers(buffers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleChange(key: string, value: string) {
    setEditBuffers((prev) => ({ ...prev, [key]: value }));
  }

  function isDirty(): boolean {
    if (!data) return false;
    for (const entry of data.keys) {
      const saved = data.overrides[entry.key] || "";
      const current = editBuffers[entry.key] || "";
      if (saved !== current) return true;
    }
    return false;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings/env-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: editBuffers }),
      });
      // Refresh
      const res = await fetch("/api/settings/env-template");
      const json: EnvTemplateData = await res.json();
      setData(json);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  }

  if (!data || !data.source) {
    return (
      <div className="p-6 text-sm text-gray-500">
        No .env or .env.example found in the main repository.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          Override environment variables for worktrees. Source:{" "}
          <span className="font-mono text-gray-400">{data.source}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {data.placeholders.map((p) => (
            <span
              key={p}
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Key-value override editor */}
      <div className="space-y-1.5">
        {data.keys.map((entry) => (
          <div key={entry.key} className="flex items-center gap-3">
            <span className="font-mono text-xs text-gray-300 w-[200px] shrink-0 truncate">
              {entry.key}
            </span>
            <input
              type="text"
              value={editBuffers[entry.key] || ""}
              onChange={(e) => handleChange(entry.key, e.target.value)}
              placeholder={entry.value || "(empty)"}
              className="glass-input flex-1 rounded px-2.5 py-1.5 text-xs text-gray-200 font-mono"
            />
          </div>
        ))}
      </div>

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
