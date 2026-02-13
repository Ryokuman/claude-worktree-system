"use client";

import { useState } from "react";
import type { DeactiveBranch } from "@/lib/types";

interface AddWorktreeDialogProps {
  branches: DeactiveBranch[];
  onAdd: (branch: string) => void;
  onClose: () => void;
}

export function AddWorktreeDialog({
  branches,
  onAdd,
  onClose,
}: AddWorktreeDialogProps) {
  const [selected, setSelected] = useState("");
  const [healthCheckPath, setHealthCheckPath] = useState("/");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/worktrees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: selected, healthCheckPath }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create worktree");
        return;
      }
      onAdd(selected);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4">Add Worktree</h2>

        <label className="block text-sm text-gray-400 mb-2">
          Select branch
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 mb-4 focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Select --</option>
          {branches.map((b) => (
            <option key={b.branch} value={b.branch}>
              {b.taskNo} - {b.branch}
            </option>
          ))}
        </select>

        <label className="block text-sm text-gray-400 mb-2">
          Health check path
        </label>
        <input
          type="text"
          value={healthCheckPath}
          onChange={(e) => setHealthCheckPath(e.target.value)}
          placeholder="/"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 mb-4 focus:outline-none focus:border-blue-500"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || loading}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
