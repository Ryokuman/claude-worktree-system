"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTerminal } from "@/components/terminal/useTerminal";
import type { JiraCliStatus, JiraCliConfig } from "@/lib/types";

function InstallTerminal({ onDone }: { onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useTerminal(ref, {
    sessionId: "jira-install",
    initialCommand: "brew install ankitpokhrel/jira-cli/jira-cli",
    killOnUnmount: false,
    onExit: (code) => onDone(code === 0),
  });
  return <div ref={ref} className="rounded-lg overflow-hidden" style={{ height: 200 }} />;
}

export function JiraCliTab() {
  const [status, setStatus] = useState<JiraCliStatus | null>(null);
  const [config, setConfig] = useState<JiraCliConfig | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);

  const [form, setForm] = useState({
    server: "",
    login: "",
    projectKey: "",
    installationType: "cloud" as "cloud" | "local",
    boardId: "",
    apiToken: "",
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/jira");
      const data = await res.json();
      setStatus(data.status);
      setConfig(data.config);
      setHasToken(data.hasToken);
      if (data.config) {
        setForm((f) => ({
          ...f,
          server: data.config.server || "",
          login: data.config.login || "",
          projectKey: data.config.projectKey || "",
          installationType: data.config.installationType || "cloud",
          boardId: data.config.boardId || "",
        }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/jira", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchStatus();
        setForm((f) => ({ ...f, apiToken: "" }));
      }
    } finally {
      setSaving(false);
    }
  }

  function set(key: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  const installed = status?.installed;
  const canSave = form.server && form.login && form.projectKey && (form.apiToken || hasToken);

  return (
    <div className="p-5 space-y-5">
      {/* Install status */}
      <div className="glass-card rounded-lg p-4 flex items-center gap-3">
        {installed ? (
          <>
            <span className="text-green-400">●</span>
            <span className="text-sm text-gray-200">
              jira-cli {status?.version || "installed"}
            </span>
          </>
        ) : (
          <>
            <span className="text-yellow-400">●</span>
            <span className="text-sm text-gray-300 flex-1">jira-cli not found</span>
            {!installing && (
              <button
                onClick={() => setInstalling(true)}
                className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white"
              >
                Install
              </button>
            )}
          </>
        )}
      </div>

      {installing && !installed && (
        <InstallTerminal
          onDone={(ok) => {
            if (ok) fetchStatus();
          }}
        />
      )}

      {/* Config form */}
      {installed && (
        <div className="space-y-3">
          {([
            ["server", "Server URL", "https://company.atlassian.net"],
            ["login", "Email", "user@company.com"],
            ["apiToken", "API Token", hasToken ? "(saved — enter to replace)" : "token"],
            ["projectKey", "Project Key", "PROJ"],
            ["boardId", "Board ID (optional)", "123"],
          ] as const).map(([key, label, ph]) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type={key === "apiToken" ? "password" : "text"}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={ph}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono"
              />
            </div>
          ))}

          <div className="flex items-center gap-3">
            <select
              value={form.installationType}
              onChange={(e) => set("installationType", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm text-gray-200"
            >
              <option value="cloud">Cloud</option>
              <option value="local">Local</option>
            </select>

            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="glass-button-primary rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ml-auto"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
