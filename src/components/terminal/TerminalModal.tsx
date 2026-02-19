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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-2 glass-modal border-b border-white/10">
        <span className="text-sm text-gray-300 font-mono">
          Terminal - {title}
        </span>
        <button
          onClick={onClose}
          className="glass-button rounded px-3 py-1 text-xs font-medium text-gray-300 hover:text-gray-100"
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
