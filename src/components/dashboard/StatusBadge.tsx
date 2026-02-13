"use client";

export function StatusBadge({ status }: { status: "running" | "stopped" }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
      <span className="h-2 w-2 rounded-full bg-gray-500" />
      stopped
    </span>
  );
}
