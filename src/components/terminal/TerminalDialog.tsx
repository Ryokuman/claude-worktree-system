"use client";

import { useRef } from "react";
import { useTerminal, type TerminalOptions } from "./useTerminal";

function TerminalMount({ options }: { options: TerminalOptions }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, options);
  return <div ref={containerRef} className="h-full w-full" />;
}

interface TerminalDialogProps {
  title: string;
  cwd?: string;
  initialCommand?: string;
  onClose: () => void;
}

export function TerminalDialog({
  title,
  cwd,
  initialCommand,
  onClose,
}: TerminalDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-[80vw] h-[70vh] rounded-lg border border-gray-700 bg-gray-950 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <span className="text-sm text-gray-300 font-mono truncate">
            {title}
          </span>
          <button
            onClick={onClose}
            className="ml-4 rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <TerminalMount options={{ cwd, initialCommand }} />
        </div>
      </div>
    </div>
  );
}
