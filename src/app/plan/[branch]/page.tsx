"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { PlanStructuredView } from "@/components/plan/PlanStructuredView";
import { PlanFileEditor } from "@/components/plan/PlanFileEditor";
import type { PlanResponse, PlanFile } from "@/lib/types";

export default function PlanPage({
  params,
}: {
  params: Promise<{ branch: string }>;
}) {
  const { branch } = use(params);
  const decodedBranch = decodeURIComponent(branch);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plan/${encodeURIComponent(decodedBranch)}`);
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
  }, [decodedBranch, selectedFile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const files: PlanFile[] = data && data.type !== "empty" ? data.files : [];
  const currentFile = files.find((f) => f.name === selectedFile);
  const isStructured = data?.type === "structured";

  async function handleSave(content: string) {
    if (!selectedFile) return;
    await fetch(`/api/plan/${encodeURIComponent(decodedBranch)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: selectedFile, content }),
    });
    setEditing(false);
    fetchData();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-100">
            Plan: {decodedBranch}
          </h1>
        </div>
        {isStructured && (
          <button
            onClick={() => setViewMode(viewMode === "structured" ? "raw" : "structured")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            {viewMode === "structured" ? "Raw 보기" : "구조화 보기"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : !data || data.type === "empty" ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 p-16">
          <p className="text-gray-500 mb-4">플랜이 없습니다</p>
          <button
            disabled
            className="rounded-lg px-4 py-2 text-sm font-medium bg-purple-900/50 text-purple-400 opacity-50 cursor-not-allowed"
            title="터미널 연동 후 사용 가능"
          >
            AI로 플랜 만들기
          </button>
        </div>
      ) : isStructured && viewMode === "structured" ? (
        <PlanStructuredView
          branch={decodedBranch}
          plan={data.plan}
          files={data.files}
          onRefresh={fetchData}
        />
      ) : (
        /* Raw file view */
        <div className="grid grid-cols-[240px_1fr] gap-4 h-[calc(100vh-200px)]">
          <div className="overflow-auto rounded-lg border border-gray-800 bg-gray-900">
            <div className="p-3 border-b border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Files
              </h3>
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
                      ? "bg-gray-800 text-gray-100"
                      : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-gray-800 bg-gray-900">
            {currentFile && !editing && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <span className="text-sm font-medium text-gray-300">
                    {currentFile.name}
                  </span>
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
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
      )}
    </div>
  );
}
