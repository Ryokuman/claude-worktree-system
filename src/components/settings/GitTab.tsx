"use client";

import { useState, useEffect, useCallback } from "react";
import type { GitAuthConfig } from "@/lib/types";

export function GitTab() {
  const [config, setConfig] = useState<GitAuthConfig | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sshKeyPath: "",
    provider: "github" as "github" | "gitlab" | "bitbucket",
    username: "",
    token: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/git");
      const data = await res.json();
      setConfig(data.config);
      setHasToken(data.hasToken);
      if (data.config) {
        setForm((f) => ({
          ...f,
          sshKeyPath: data.config.sshKeyPath || "",
          provider: data.config.provider || "github",
          username: data.config.username || "",
        }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/git", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchData();
        setForm((f) => ({ ...f, token: "" }));
      }
    } finally {
      setSaving(false);
    }
  }

  function set(key: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="p-5 space-y-5">
      <p className="text-xs text-gray-500">
        Git 인증 정보를 설정합니다. SSH 키는 터미널 시작 시 자동으로 ssh-add 됩니다.
      </p>

      <div className="space-y-3">
        {/* SSH Key Path */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">SSH Key Path</label>
          <input
            type="text"
            value={form.sshKeyPath}
            onChange={(e) => set("sshKeyPath", e.target.value)}
            placeholder="~/.ssh/id_ed25519"
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono"
          />
          <p className="text-[11px] text-gray-600 mt-0.5">
            터미널 시작 시 자동 ssh-add 될 키 경로 (ls ~/.ssh/ 로 확인)
          </p>
        </div>

        {/* Provider */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Provider</label>
          <select
            value={form.provider}
            onChange={(e) => set("provider", e.target.value)}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200"
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="bitbucket">Bitbucket</option>
          </select>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Git 호스팅 서비스 선택
          </p>
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Username</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            placeholder="username"
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono"
          />
          <p className="text-[11px] text-gray-600 mt-0.5">
            Git 호스팅 서비스의 사용자명
          </p>
        </div>

        {/* Personal Access Token */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Personal Access Token</label>
          <input
            type="password"
            value={form.token}
            onChange={(e) => set("token", e.target.value)}
            placeholder={hasToken ? "(saved — enter to replace)" : "ghp_xxxx..."}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono"
          />
          <p className="text-[11px] text-gray-600 mt-0.5">
            HTTPS 인증용 토큰 (GitHub: Settings → Developer settings → Personal access tokens)
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="glass-button-primary rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
