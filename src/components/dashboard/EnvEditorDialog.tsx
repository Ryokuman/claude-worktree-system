"use client";

import { useState, useEffect, useCallback } from "react";

interface EnvEditorDialogProps {
  taskNo: string;
  taskName: string;
  onClose: () => void;
}

export function EnvEditorDialog({
  taskNo,
  taskName,
  onClose,
}: EnvEditorDialogProps) {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  const fetchEnv = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/worktrees/${taskNo}/env`);
      const data = await res.json();
      if (data.entries) {
        setRaw(
          data.entries
            .map((e: { key: string; value: string }) => `${e.key}=${e.value}`)
            .join("\n"),
        );
      }
      setExists(data.exists);
    } finally {
      setLoading(false);
    }
  }, [taskNo]);

  useEffect(() => {
    fetchEnv();
  }, [fetchEnv]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/worktrees/${taskNo}/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save");
        return;
      }
      setExists(true);
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            <span className="text-blue-400 font-mono">{taskNo}</span>
            <span className="text-gray-400 mx-2">/</span>
            <span className="text-gray-300">.env</span>
          </h2>
          {!exists && !loading && (
            <span className="text-xs text-yellow-500">.env not found</span>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Loading...
          </div>
        ) : (
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-[300px] w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-mono text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            placeholder="KEY=value"
          />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
