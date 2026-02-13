"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { PlanFileList } from "@/components/plan/PlanFileList";
import { PlanFileViewer } from "@/components/plan/PlanFileViewer";
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
          <PlanFileList
            files={files}
            selected={selectedFile}
            onSelect={(name) => {
              setSelectedFile(name);
              setEditing(false);
            }}
          />
          <div className="overflow-auto rounded-lg border border-gray-800 bg-gray-900">
            {currentFile && !editing && (
              <PlanFileViewer
                file={currentFile}
                onEdit={() => setEditing(true)}
              />
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
