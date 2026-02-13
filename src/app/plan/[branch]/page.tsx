"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { PlanFileEditor } from "@/components/plan/PlanFileEditor";
import type { PlanFile } from "@/lib/types";

export default function PlanPage({
  params,
}: {
  params: Promise<{ branch: string }>;
}) {
  const { branch } = use(params);
  const decodedBranch = decodeURIComponent(branch);
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, [branch]);

  async function fetchFiles() {
    setLoading(true);
    try {
      const res = await fetch(`/api/plan/${encodeURIComponent(decodedBranch)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        if (data.length > 0 && !selectedFile) {
          setSelectedFile(data[0].name);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const currentFile = files.find((f) => f.name === selectedFile);

  async function handleSave(content: string) {
    if (!selectedFile) return;
    await fetch(`/api/plan/${encodeURIComponent(decodedBranch)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: selectedFile, content }),
    });
    setEditing(false);
    fetchFiles();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
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

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500">
          No plan files yet.
        </div>
      ) : (
        <div className="grid grid-cols-[240px_1fr] gap-4 h-[calc(100vh-200px)]">
          {/* File list */}
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

          {/* File content */}
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
