"use client";

import { useState } from "react";
import type { PlanFile } from "@/lib/types";

interface PlanFileEditorProps {
  file: PlanFile;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function PlanFileEditor({
  file,
  onSave,
  onCancel,
}: PlanFileEditorProps) {
  const [content, setContent] = useState(file.content);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-300">
          Editing: {file.name}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(content)}
            className="rounded px-3 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full bg-gray-950 text-gray-300 text-sm font-mono p-4 resize-none focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}
