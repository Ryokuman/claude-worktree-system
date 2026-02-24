"use client";

import { useState, useEffect } from "react";

interface TerminalInitDialogProps {
  taskNo: string;
  taskName: string;
  onClose: () => void;
}

export function TerminalInitDialog({
  taskNo,
  taskName,
  onClose,
}: TerminalInitDialogProps) {
  const [commands, setCommands] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/settings/terminal-init?taskNo=${encodeURIComponent(taskNo)}`,
        );
        const data = await res.json();
        const text = (data.commands || []).join("\n");
        setCommands(text);
        setOriginal(text);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [taskNo]);

  async function handleSave() {
    setSaving(true);
    try {
      const cmds = commands
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await fetch("/api/settings/terminal-init", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskNo, commands: cmds }),
      });
      setOriginal(commands);
    } finally {
      setSaving(false);
    }
  }

  const isDirty = commands !== original;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="glass-modal rounded-xl px-6 py-5 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              Terminal Init Commands
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {taskNo} {taskName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Commands to run when a new terminal opens for this worktree. One per
          line. Default commands from Settings are applied first.
        </p>

        {loading ? (
          <div className="text-sm text-gray-500 py-4">Loading...</div>
        ) : (
          <>
            <textarea
              value={commands}
              onChange={(e) => setCommands(e.target.value)}
              rows={5}
              className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
              placeholder="ssh-add ~/.ssh/id_ed25519"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                className="glass-button rounded px-3 py-1.5 text-xs font-medium text-gray-300"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
