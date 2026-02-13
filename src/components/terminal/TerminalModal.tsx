"use client";

import { useRef } from "react";
import { useTerminal, type TerminalOptions } from "./useTerminal";

function TerminalMount({ options }: { options: TerminalOptions }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, options);
  return <div ref={containerRef} className="h-full w-full" />;
}

interface TerminalModalProps {
  title: string;
  cwd?: string;
  initialCommand?: string;
  closeLabel?: string;
  onClose: () => void;
}

export function TerminalModal({
  title,
  cwd,
  initialCommand,
  closeLabel = "Close",
  onClose,
}: TerminalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-sm text-gray-300 font-mono">
          Terminal - {title}
        </span>
        <button
          onClick={onClose}
          className="rounded px-3 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
        >
          {closeLabel}
        </button>
      </div>
      <div className="flex-1 p-1">
        <TerminalMount options={{ cwd, initialCommand }} />
      </div>
    </div>
  );
}
