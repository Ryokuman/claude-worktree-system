"use client";

import type { PlanFile } from "@/lib/types";

interface PlanFileListProps {
  files: PlanFile[];
  selected: string | null;
  onSelect: (name: string) => void;
}

export function PlanFileList({ files, selected, onSelect }: PlanFileListProps) {
  return (
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
            onClick={() => onSelect(file.name)}
            className={`text-left px-3 py-2 text-sm transition-colors ${
              selected === file.name
                ? "bg-gray-800 text-gray-100"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>
    </div>
  );
}
