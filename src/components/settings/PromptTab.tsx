"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveWorktree } from "@/lib/types";

interface PromptFile {
  name: string;
  content: string;
}

export function PromptTab() {
  const [files, setFiles] = useState<PromptFile[]>([]);
  const [perWorktree, setPerWorktree] = useState<Record<string, string>>({});
  const [active, setActive] = useState<ActiveWorktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [fileBuffers, setFileBuffers] = useState<Record<string, string>>({});
  const [wtBuffers, setWtBuffers] = useState<Record<string, string>>({});

  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileError, setNewFileError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/prompt");
      const result = await res.json();
      const fetchedFiles: PromptFile[] = result.files || [];
      const fetchedPw: Record<string, string> = result.perWorktree || {};

      setFiles(fetchedFiles);
      setPerWorktree(fetchedPw);
      setActive(result.active || []);

      const fBuf: Record<string, string> = {};
      for (const f of fetchedFiles) {
        fBuf[f.name] = f.content;
      }
      setFileBuffers(fBuf);

      const wBuf: Record<string, string> = {};
      for (const wt of result.active || []) {
        wBuf[wt.taskNo] = fetchedPw[wt.taskNo] || "";
      }
      setWtBuffers(wBuf);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── File actions ──────────────────────────── */

  async function handleAddFile() {
    const name = newFileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!name) {
      setNewFileError("파일명을 입력하세요");
      return;
    }
    if (files.some((f) => f.name === name)) {
      setNewFileError("이미 존재하는 파일명입니다");
      return;
    }

    setSaving("new");
    setNewFileError("");
    try {
      const res = await fetch("/api/settings/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveFile", name, content: "" }),
      });
      const result = await res.json();
      if (result.error) {
        setNewFileError(result.error);
        return;
      }
      setNewFileName("");
      setShowNewFile(false);
      await fetchData();
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveFile(name: string) {
    setSaving(name);
    try {
      await fetch("/api/settings/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveFile",
          name,
          content: fileBuffers[name] || "",
        }),
      });
      await fetchData();
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteFile(name: string) {
    setSaving(name);
    try {
      await fetch("/api/settings/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteFile", name }),
      });
      await fetchData();
    } finally {
      setSaving(null);
    }
  }

  /* ── Per-worktree actions ──────────────────── */

  async function handleSaveWorktree(taskNo: string) {
    setSaving(`wt-${taskNo}`);
    try {
      await fetch("/api/settings/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "savePerWorktree",
          taskNo,
          content: wtBuffers[taskNo] || "",
        }),
      });
      await fetchData();
    } finally {
      setSaving(null);
    }
  }

  /* ── Dirty checks ──────────────────────────── */

  function isFileDirty(name: string): boolean {
    const original = files.find((f) => f.name === name);
    return (fileBuffers[name] ?? "") !== (original?.content ?? "");
  }

  function isWtDirty(taskNo: string): boolean {
    return (wtBuffers[taskNo] ?? "") !== (perWorktree[taskNo] ?? "");
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-5 space-y-6">
      <p className="text-xs text-gray-500">
        Claude Code 시스템 프롬프트 파일을 관리합니다. 각 파일은 대상 워크트리의
        .claude/&#123;name&#125;.md로 기록됩니다.
      </p>

      {/* ── Default prompt files ────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Prompt Files (all worktrees)
          </h3>
          {!showNewFile && (
            <button
              onClick={() => setShowNewFile(true)}
              className="glass-button-primary rounded px-2.5 py-1 text-xs font-medium text-white"
            >
              + Add File
            </button>
          )}
        </div>

        {/* New file form */}
        {showNewFile && (
          <div className="glass-card rounded-lg p-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">.claude/</span>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => {
                  setNewFileName(e.target.value);
                  setNewFileError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
                placeholder="file-name"
                className="glass-input flex-1 rounded px-2 py-1.5 text-sm text-gray-200 font-mono min-w-0"
                autoFocus
              />
              <span className="text-xs text-gray-400 shrink-0">.md</span>
              <button
                onClick={handleAddFile}
                disabled={!newFileName.trim() || saving === "new"}
                className="glass-button-primary rounded px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 shrink-0"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewFile(false);
                  setNewFileName("");
                  setNewFileError("");
                }}
                className="text-xs text-gray-500 hover:text-gray-300 shrink-0"
              >
                Cancel
              </button>
            </div>
            {newFileError && (
              <p className="text-xs text-red-400 mt-1.5">{newFileError}</p>
            )}
          </div>
        )}

        {files.length === 0 && !showNewFile && (
          <div className="text-xs text-gray-500 py-4 text-center">
            프롬프트 파일이 없습니다. &quot;+ Add File&quot;로 추가하세요.
          </div>
        )}

        <div className="space-y-3">
          {files.map((file) => (
            <div key={file.name} className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-blue-400">
                  .claude/{file.name}.md
                </span>
                <button
                  onClick={() => handleDeleteFile(file.name)}
                  disabled={saving === file.name}
                  className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
              <textarea
                value={fileBuffers[file.name] ?? ""}
                onChange={(e) =>
                  setFileBuffers((prev) => ({
                    ...prev,
                    [file.name]: e.target.value,
                  }))
                }
                rows={6}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
                placeholder="프롬프트 내용을 입력하세요..."
              />
              {isFileDirty(file.name) && (
                <button
                  onClick={() => handleSaveFile(file.name)}
                  disabled={saving === file.name}
                  className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white mt-2"
                >
                  {saving === file.name ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Per-worktree prompts ────────────────── */}
      {active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Per-Worktree (.claude/task-prompt.md)
          </h3>
          <div className="space-y-4">
            {active.map((wt) => (
              <div key={wt.taskNo} className="glass-card rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold text-blue-400">
                    {wt.taskNo}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {wt.taskName}
                  </span>
                </div>
                <textarea
                  value={wtBuffers[wt.taskNo] ?? ""}
                  onChange={(e) =>
                    setWtBuffers((prev) => ({
                      ...prev,
                      [wt.taskNo]: e.target.value,
                    }))
                  }
                  rows={4}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm text-gray-200 font-mono resize-y"
                  placeholder="이 워크트리에만 적용할 추가 프롬프트..."
                />
                {isWtDirty(wt.taskNo) && (
                  <button
                    onClick={() => handleSaveWorktree(wt.taskNo)}
                    disabled={saving === `wt-${wt.taskNo}`}
                    className="glass-button-primary rounded px-3 py-1.5 text-xs font-medium text-white mt-2"
                  >
                    {saving === `wt-${wt.taskNo}` ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
