"use client";

import type { PlanFile } from "@/lib/types";

interface PlanFileViewerProps {
  file: PlanFile;
  onEdit: () => void;
}

export function PlanFileViewer({ file, onEdit }: PlanFileViewerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-300">{file.name}</span>
        <button
          onClick={onEdit}
          className="rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
        >
          Edit
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">
        {file.content}
      </pre>
    </div>
  );
}
