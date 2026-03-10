"use client";

import { useState, useEffect, useCallback } from "react";

interface McpServerConfig {
  enabled: boolean;
  displayName: string;
  command: string;
  args: string[];
  portKey?: string;
  portRangeStart: number;
  portRangeEnd: number;
  options: Record<string, unknown>;
}

interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export function McpTab() {
  const [config, setConfig] = useState<McpConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<McpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/mcp");
      const data: McpConfig = await res.json();
      setConfig(data);
      setSavedConfig(data);
      // Select first server by default
      const keys = Object.keys(data.servers);
      if (keys.length > 0 && !selectedServer) {
        setSelectedServer(keys[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updateServer(key: string, updates: Partial<McpServerConfig>) {
    if (!config) return;
    setConfig({
      ...config,
      servers: {
        ...config.servers,
        [key]: { ...config.servers[key], ...updates },
      },
    });
  }

  function isDirty(): boolean {
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await fetch("/api/settings/mcp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const res = await fetch("/api/settings/mcp");
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

  const serverKeys = Object.keys(config.servers);
  const server = selectedServer ? config.servers[selectedServer] : null;

  return (
    <div className="flex h-full">
      {/* Sub-menu sidebar */}
      <div className="w-[140px] shrink-0 border-r border-white/8">
        <div className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
            MCP Servers
          </p>
          {serverKeys.map((key) => (
            <button
              key={key}
              onClick={() => setSelectedServer(key)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                selectedServer === key
                  ? "bg-blue-400/15 text-blue-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {config.servers[key].displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Server settings */}
      <div className="flex-1 p-5 overflow-auto">
        {server ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">
                {server.displayName}
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-400">
                  {server.enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                  onClick={() =>
                    updateServer(selectedServer, {
                      enabled: !server.enabled,
                    })
                  }
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    server.enabled ? "bg-blue-500" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      server.enabled ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Command (read-only display) */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                Command
              </label>
              <div className="font-mono text-xs text-gray-400 mt-1 px-2.5 py-1.5 glass-card rounded">
                {server.command} {server.args.join(" ")}
              </div>
            </div>

            {/* Port Range */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                Port Range
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={server.portRangeStart}
                  onChange={(e) =>
                    updateServer(selectedServer, {
                      portRangeStart: parseInt(e.target.value) || 0,
                    })
                  }
                  className="glass-input w-24 rounded px-2.5 py-1.5 text-xs text-gray-200 font-mono"
                />
                <span className="text-xs text-gray-500">~</span>
                <input
                  type="number"
                  value={server.portRangeEnd}
                  onChange={(e) =>
                    updateServer(selectedServer, {
                      portRangeEnd: parseInt(e.target.value) || 0,
                    })
                  }
                  className="glass-input w-24 rounded px-2.5 py-1.5 text-xs text-gray-200 font-mono"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Each worktree gets a unique port offset from the start.
              </p>
            </div>

            {/* Headless option */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!server.options.headless}
                  onChange={(e) =>
                    updateServer(selectedServer, {
                      options: {
                        ...server.options,
                        headless: e.target.checked,
                      },
                    })
                  }
                  className="w-3.5 h-3.5 rounded border-gray-500 bg-transparent"
                />
                <span className="text-xs text-gray-300">Headless mode</span>
              </label>
              <p className="text-[10px] text-gray-500 mt-1 ml-5">
                Run browser without GUI. Required for parallel worktrees.
              </p>
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
        ) : (
          <div className="text-sm text-gray-500">Select an MCP server</div>
        )}
      </div>
    </div>
  );
}
