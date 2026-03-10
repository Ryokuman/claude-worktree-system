"use client";

import { useState, useEffect, useCallback } from "react";

interface TemplateStatus {
  env: { exists: boolean };
  mcp: { exists: boolean; hasEnabled: boolean };
}

interface ApplyTemplateDialogProps {
  taskNo: string;
  taskName: string;
  onClose: () => void;
}

export function ApplyTemplateDialog({
  taskNo,
  taskName,
  onClose,
}: ApplyTemplateDialogProps) {
  const [status, setStatus] = useState<TemplateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<{ env: boolean; mcp: boolean }>({
    env: false,
    mcp: false,
  });
  const [result, setResult] = useState<Record<string, boolean> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/worktrees/${taskNo}/apply-template`);
      const data: TemplateStatus = await res.json();
      setStatus(data);
      // Pre-select items that don't exist yet (create mode)
      setSelected({
        env: !data.env.exists,
        mcp: !data.mcp.exists && data.mcp.hasEnabled,
      });
    } finally {
      setLoading(false);
    }
  }, [taskNo]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleApply() {
    if (!selected.env && !selected.mcp) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/worktrees/${taskNo}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const data = await res.json();
      setResult(data.results || {});
      // Refresh status
      const statusRes = await fetch(`/api/worktrees/${taskNo}/apply-template`);
      setStatus(await statusRes.json());
    } finally {
      setApplying(false);
    }
  }

  function getLabel(
    key: "env" | "mcp",
    exists: boolean,
  ): { action: string; desc: string; color: string } {
    if (exists) {
      return {
        action: "Overwrite",
        desc: "File exists — will be overwritten",
        color: "text-yellow-400",
      };
    }
    return {
      action: "Create",
      desc: "File does not exist — will be created",
      color: "text-green-400",
    };
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-modal rounded-xl px-6 py-5 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">
              Apply Templates
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-mono text-blue-400">{taskNo}</span>{" "}
              {taskName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-4">Loading...</div>
        ) : status ? (
          <div className="space-y-3">
            {/* .env */}
            <label className="flex items-start gap-3 p-3 rounded-lg glass-card cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={selected.env}
                onChange={(e) =>
                  setSelected((p) => ({ ...p, env: e.target.checked }))
                }
                className="mt-0.5 w-3.5 h-3.5 rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-200">
                    .env
                  </span>
                  <span
                    className={`text-[10px] ${getLabel("env", status.env.exists).color}`}
                  >
                    {getLabel("env", status.env.exists).action}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {getLabel("env", status.env.exists).desc}
                </p>
              </div>
            </label>

            {/* .mcp.json */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg glass-card transition-colors ${
                status.mcp.hasEnabled
                  ? "cursor-pointer hover:border-white/20"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.mcp}
                onChange={(e) =>
                  setSelected((p) => ({ ...p, mcp: e.target.checked }))
                }
                disabled={!status.mcp.hasEnabled}
                className="mt-0.5 w-3.5 h-3.5 rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-200">
                    .mcp.json
                  </span>
                  {status.mcp.hasEnabled ? (
                    <span
                      className={`text-[10px] ${getLabel("mcp", status.mcp.exists).color}`}
                    >
                      {getLabel("mcp", status.mcp.exists).action}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-600">
                      No MCP servers enabled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {status.mcp.hasEnabled
                    ? getLabel("mcp", status.mcp.exists).desc
                    : "Enable MCP servers in Settings first"}
                </p>
              </div>
            </label>

            {/* Result message */}
            {result && (
              <div className="text-xs text-green-400 bg-green-400/10 rounded-lg px-3 py-2">
                Applied:{" "}
                {Object.entries(result)
                  .filter(([, v]) => v)
                  .map(([k]) => (k === "env" ? ".env" : ".mcp.json"))
                  .join(", ") || "nothing"}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="glass-button rounded px-3 py-1.5 text-xs text-gray-400"
              >
                Close
              </button>
              <button
                onClick={handleApply}
                disabled={applying || (!selected.env && !selected.mcp)}
                className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {applying ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
