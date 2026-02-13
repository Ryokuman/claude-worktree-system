"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EndedWorktree } from "@/lib/types";

export default function EndedPage() {
  const [ended, setEnded] = useState<EndedWorktree[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setEnded(data.ended);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          &larr; Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-100">Ended Tasks</h1>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : ended.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500">
          No completed tasks yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ended.map((item) => (
            <div
              key={item.taskNo}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-semibold text-gray-400">
                  {item.taskNo}
                </span>
                <span className="text-sm text-gray-300">{item.taskName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/plan/${encodeURIComponent(item.branch)}`}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  plan
                </Link>
                <span className="text-xs text-gray-600">
                  {item.completedAt}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
