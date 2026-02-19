"use client";

import { useState, useEffect, useCallback } from "react";

interface EnvEntry {
  key: string;
  value: string;
}

interface EnvEditorDialogProps {
  taskNo: string;
  taskName: string;
  onClose: () => void;
}

type EditMode = "structured" | "raw";

export function EnvEditorDialog({
  taskNo,
  taskName,
  onClose,
}: EnvEditorDialogProps) {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<EditMode>("structured");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync between modes
  function toRaw(e: EnvEntry[]): string {
    return e.map((x) => `${x.key}=${x.value}`).join("\n");
  }

  function toEntries(r: string): EnvEntry[] {
    return r
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return t && !t.startsWith("#");
      })
      .map((line) => {
        const idx = line.indexOf("=");
        if (idx === -1) return { key: line.trim(), value: "" };
        return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
      });
  }

  function switchMode(next: EditMode) {
    if (next === mode) return;
    if (mode === "structured" && next === "raw") {
      setRaw(toRaw(entries));
    } else if (mode === "raw" && next === "structured") {
      setEntries(toEntries(raw));
    }
    setMode(next);
  }

  const fetchEnv = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/worktrees/${taskNo}/env`);
      const data = await res.json();
      if (data.entries) {
        setEntries(data.entries);
        setRaw(toRaw(data.entries));
      }
      setExists(data.exists);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [taskNo]);

  useEffect(() => {
    fetchEnv();
  }, [fetchEnv]);

  // Structured mode handlers
  function updateEntry(index: number, field: "key" | "value", val: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: val } : e)),
    );
    setDirty(true);
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  function addEntry() {
    setEntries((prev) => [...prev, { key: "", value: "" }]);
    setDirty(true);
  }

  function handleRawChange(val: string) {
    setRaw(val);
    setDirty(true);
  }

  // Load from main repo
  async function handleLoadFromMain() {
    const res = await fetch("/api/env/template");
    const data = await res.json();
    if (!data.mainEnv) {
      alert("메인 레포에 .env 파일이 없습니다.");
      return;
    }
    const mainEntries: EnvEntry[] = data.mainEnv.entries;

    if (entries.length === 0) {
      // No existing env — just replace
      setEntries(mainEntries);
      setRaw(toRaw(mainEntries));
      setDirty(true);
      return;
    }

    // Merge: add missing keys, keep existing values
    const existingKeys = new Set(entries.map((e) => e.key));
    const merged = [
      ...entries,
      ...mainEntries.filter((e) => !existingKeys.has(e.key)),
    ];
    setEntries(merged);
    setRaw(toRaw(merged));
    setDirty(true);
  }

  // Save
  async function handleSave() {
    setSaving(true);
    try {
      const saveEntries =
        mode === "structured"
          ? entries.filter((e) => e.key.trim())
          : toEntries(raw);

      const res = await fetch(`/api/worktrees/${taskNo}/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: saveEntries }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save");
        return;
      }
      setExists(true);
      setDirty(false);
      // Re-sync both representations
      if (mode === "structured") {
        setRaw(toRaw(saveEntries));
      } else {
        setEntries(saveEntries);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              <span className="text-blue-400 font-mono">{taskNo}</span>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-300">.env</span>
            </h2>
            {!exists && !loading && (
              <span className="text-xs text-yellow-500">.env not found</span>
            )}
            {dirty && (
              <span className="text-xs text-orange-400">unsaved</span>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => switchMode("structured")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === "structured"
                  ? "bg-gray-700 text-gray-200"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Table
            </button>
            <button
              onClick={() => switchMode("raw")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === "raw"
                  ? "bg-gray-700 text-gray-200"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Raw
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm py-16">
            Loading...
          </div>
        ) : mode === "structured" ? (
          <div className="flex-1 overflow-y-auto min-h-[300px] space-y-1.5">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={entry.key}
                  onChange={(e) => updateEntry(i, "key", e.target.value)}
                  spellCheck={false}
                  placeholder="KEY"
                  className="w-[35%] shrink-0 rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 font-mono text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={entry.value}
                  onChange={(e) => updateEntry(i, "value", e.target.value)}
                  spellCheck={false}
                  placeholder="value"
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 font-mono text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => removeEntry(i)}
                  className="shrink-0 rounded px-1.5 py-1 text-xs text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  title="Remove"
                >
                  x
                </button>
              </div>
            ))}
            <button
              onClick={addEntry}
              className="w-full rounded border border-dashed border-gray-700 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
            >
              + Add variable
            </button>
          </div>
        ) : (
          <textarea
            value={raw}
            onChange={(e) => handleRawChange(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-[300px] w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-mono text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            placeholder="KEY=value"
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handleLoadFromMain}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 disabled:opacity-50 transition-colors"
          >
            Load from main repo
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !dirty}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
