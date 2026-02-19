"use client";

import { useState, useEffect, useCallback } from "react";

interface EnvEntry {
  key: string;
  value: string;
}

interface EnvTemplate {
  source: string;
  overrides: Record<string, string>;
}

interface EnvEditorDialogProps {
  taskNo: string;
  taskName: string;
  onClose: () => void;
}

type EditMode = "structured" | "raw" | "template";

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

  // Template state
  const [tplKeys, setTplKeys] = useState<EnvEntry[]>([]);
  const [tplOverrides, setTplOverrides] = useState<Record<string, string>>({});
  const [tplLoading, setTplLoading] = useState(false);
  const [tplDirty, setTplDirty] = useState(false);

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
    if (next === "template" && tplKeys.length === 0) {
      fetchTemplate();
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

  // Template fetch
  async function fetchTemplate() {
    setTplLoading(true);
    try {
      const res = await fetch("/api/env/template");
      const data = await res.json();
      if (data.mainEnv) {
        setTplKeys(data.mainEnv.entries);
      }
      if (data.template) {
        setTplOverrides(data.template.overrides || {});
      }
      setTplDirty(false);
    } finally {
      setTplLoading(false);
    }
  }

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

  // Template mode handlers
  function updateOverride(key: string, val: string) {
    setTplOverrides((prev) => {
      const next = { ...prev };
      if (val) {
        next[key] = val;
      } else {
        delete next[key];
      }
      return next;
    });
    setTplDirty(true);
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
      setEntries(mainEntries);
      setRaw(toRaw(mainEntries));
      setDirty(true);
      return;
    }

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
      if (mode === "template") {
        const res = await fetch("/api/env/template", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: ".env", overrides: tplOverrides }),
        });
        if (!res.ok) {
          alert("Failed to save template");
          return;
        }
        setTplDirty(false);
      } else {
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
        if (mode === "structured") {
          setRaw(toRaw(saveEntries));
        } else {
          setEntries(saveEntries);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const isDirty = mode === "template" ? tplDirty : dirty;
  const isLoading = mode === "template" ? tplLoading : loading;

  return (
    <div
      className="backdrop-glass fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-modal w-full max-w-2xl rounded-xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              <span className="text-blue-400 font-mono">{taskNo}</span>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-300">.env</span>
            </h2>
            {!exists && !loading && mode !== "template" && (
              <span className="text-xs text-yellow-500">.env not found</span>
            )}
            {isDirty && (
              <span className="text-xs text-orange-400">unsaved</span>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 glass-card rounded-lg p-0.5">
            {(["structured", "raw", "template"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === m
                    ? "bg-white/10 text-gray-100"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {m === "structured" ? "Table" : m === "raw" ? "Raw" : "Template"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
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
                  className="glass-input w-[35%] shrink-0 rounded px-2.5 py-1.5 font-mono text-xs text-gray-200"
                />
                <input
                  value={entry.value}
                  onChange={(e) => updateEntry(i, "value", e.target.value)}
                  spellCheck={false}
                  placeholder="value"
                  className="glass-input flex-1 rounded px-2.5 py-1.5 font-mono text-xs text-gray-300"
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
              className="w-full rounded border border-dashed border-white/10 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
            >
              + Add variable
            </button>
          </div>
        ) : mode === "raw" ? (
          <textarea
            value={raw}
            onChange={(e) => handleRawChange(e.target.value)}
            spellCheck={false}
            className="glass-input flex-1 min-h-[300px] w-full rounded-lg px-4 py-3 font-mono text-sm text-gray-200 resize-none"
            placeholder="KEY=value"
          />
        ) : (
          /* Template mode */
          <div className="flex-1 overflow-y-auto min-h-[300px] space-y-1">
            <p className="text-xs text-gray-500 mb-3">
              새 워크트리 생성 시 자동 적용됩니다. 비워두면 메인 레포 값 그대로 사용.
              <br />
              <span className="text-gray-400">
                사용 가능: {`{{PORT}}`} {`{{BRANCH}}`} {`{{TASK_NO}}`}
              </span>
            </p>
            {tplKeys.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2">
                <span className="w-[35%] shrink-0 px-2.5 py-1.5 font-mono text-xs text-gray-400 truncate" title={entry.key}>
                  {entry.key}
                </span>
                <div className="flex-1 relative">
                  <input
                    value={tplOverrides[entry.key] ?? ""}
                    onChange={(e) => updateOverride(entry.key, e.target.value)}
                    spellCheck={false}
                    placeholder={entry.value}
                    className={`w-full rounded border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                      tplOverrides[entry.key]
                        ? "border-blue-400/40 bg-blue-500/10 text-blue-300"
                        : "border-white/10 bg-slate-900/50 text-gray-500"
                    }`}
                  />
                </div>
                {!tplOverrides[entry.key]?.includes("{{PORT}}") && (
                  <button
                    onClick={() =>
                      updateOverride(entry.key, tplOverrides[entry.key]
                        ? tplOverrides[entry.key] + "{{PORT}}"
                        : "{{PORT}}")
                    }
                    className="shrink-0 rounded px-1.5 py-1 text-[10px] text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition-colors border border-gray-700 hover:border-blue-800"
                    title="Insert {{PORT}}"
                  >
                    +PORT
                  </button>
                )}
              </div>
            ))}
            {tplKeys.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                메인 레포에 .env 파일이 없습니다.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4">
          {mode !== "template" ? (
            <button
              onClick={handleLoadFromMain}
              disabled={isLoading}
              className="glass-button rounded-lg px-3 py-2 text-xs text-gray-300 hover:text-gray-100 disabled:opacity-50"
            >
              Load from main repo
            </button>
          ) : (
            <span className="text-xs text-gray-600">전역 설정 (모든 워크트리에 적용)</span>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving || isLoading || !isDirty}
              className="glass-button-primary rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
