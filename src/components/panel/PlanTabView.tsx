"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { PlanStructuredView } from "@/components/plan/PlanStructuredView";
import { PlanFileEditor } from "@/components/plan/PlanFileEditor";
import type { PlanResponse, PlanFile } from "@/lib/types";

const TerminalDialog = dynamic(
  () =>
    import("@/components/terminal/TerminalDialog").then(
      (mod) => mod.TerminalDialog,
    ),
  { ssr: false },
);

interface PlanTabViewProps {
  branch: string;
  worktreePath: string;
}

export function PlanTabView({ branch, worktreePath }: PlanTabViewProps) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  const encodedBranch = encodeURIComponent(branch);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plan/${encodedBranch}`);
      if (res.ok) {
        const result: PlanResponse = await res.json();
        setData(result);
        if (result.type !== "empty" && result.files.length > 0 && !selectedFile) {
          setSelectedFile(result.files[0].name);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [encodedBranch, selectedFile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const files: PlanFile[] = data && data.type !== "empty" ? data.files : [];
  const currentFile = files.find((f) => f.name === selectedFile);
  const isStructured = data?.type === "structured";

  async function handleSave(content: string) {
    if (!selectedFile) return;
    await fetch(`/api/plan/${encodedBranch}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: selectedFile, content }),
    });
    setEditing(false);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!data || data.type === "empty") {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-500 mb-4">플랜이 없습니다</p>
        <button
          onClick={() => setShowTerminal(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{
            background:
              "linear-gradient(135deg, rgb(147 51 234 / 0.5) 0%, rgb(126 34 206 / 0.4) 100%)",
            border: "1px solid rgb(147 51 234 / 0.3)",
          }}
        >
          AI로 플랜 만들기
        </button>
        {showTerminal && (
          <TerminalDialog
            title={`Plan: ${branch}`}
            cwd={worktreePath}
            initialCommand={`claude "이 프로젝트의 개발 플랜을 작성해주세요. .claude/plan/ 디렉토리에 plan.json과 스텝별 .md 파일로 작성하세요. plan.json 형식: {\\\"title\\\": \\\"플랜 제목\\\", \\\"steps\\\": [{\\\"id\\\": \\\"01\\\", \\\"title\\\": \\\"스텝 제목\\\", \\\"file\\\": \\\"01-name.md\\\", \\\"status\\\": \\\"pending\\\"}]}. 각 스텝은 별도 md 파일로 상세 명세를 작성하세요."`}
            onClose={() => {
              setShowTerminal(false);
              fetchData();
            }}
          />
        )}
      </div>
    );
  }

  if (isStructured && viewMode === "structured") {
    return (
      <div className="p-4">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setViewMode("raw")}
            className="glass-button rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Raw 보기
          </button>
        </div>
        <PlanStructuredView
          branch={branch}
          plan={data.plan}
          files={data.files}
          onRefresh={fetchData}
          onOpenAI={() => setShowTerminal(true)}
        />
        {showTerminal && (
          <TerminalDialog
            title={`Plan: ${branch}`}
            cwd={worktreePath}
            initialCommand={`claude "이 프로젝트의 개발 플랜을 작성해주세요. .claude/plan/ 디렉토리에 plan.json과 스텝별 .md 파일로 작성하세요. plan.json 형식: {\\\"title\\\": \\\"플랜 제목\\\", \\\"steps\\\": [{\\\"id\\\": \\\"01\\\", \\\"title\\\": \\\"스텝 제목\\\", \\\"file\\\": \\\"01-name.md\\\", \\\"status\\\": \\\"pending\\\"}]}. 각 스텝은 별도 md 파일로 상세 명세를 작성하세요."`}
            onClose={() => {
              setShowTerminal(false);
              fetchData();
            }}
          />
        )}
      </div>
    );
  }

  // Raw view
  return (
    <div className="flex h-full">
      <div className="w-60 border-r border-white/8 overflow-auto">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Files
          </h3>
          {isStructured && (
            <button
              onClick={() => setViewMode("structured")}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              구조화 보기
            </button>
          )}
        </div>
        <div className="flex flex-col">
          {files.map((file) => (
            <button
              key={file.name}
              onClick={() => {
                setSelectedFile(file.name);
                setEditing(false);
              }}
              className={`text-left px-3 py-2 text-sm transition-colors ${
                selectedFile === file.name
                  ? "bg-white/10 text-gray-100"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {currentFile && !editing && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <span className="text-sm font-medium text-gray-300">
                {currentFile.name}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="glass-button rounded px-3 py-1 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
              >
                Edit
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {currentFile.content}
            </pre>
          </div>
        )}
        {currentFile && editing && (
          <PlanFileEditor
            file={currentFile}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
    </div>
  );
}
