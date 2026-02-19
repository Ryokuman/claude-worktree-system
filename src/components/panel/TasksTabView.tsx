"use client";

import { useState, useEffect, useCallback } from "react";
import type { PlanJson, PlanStepStatus } from "@/lib/types";

interface TasksTabViewProps {
  branch: string;
}

const STATUS_CONFIG: Record<
  PlanStepStatus,
  { label: string; bg: string; text: string; border: string; next: PlanStepStatus }
> = {
  pending: {
    label: "대기",
    bg: "bg-gray-500/20",
    text: "text-gray-300",
    border: "border-gray-500/30",
    next: "in_progress",
  },
  in_progress: {
    label: "진행중",
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    next: "done",
  },
  done: {
    label: "완료",
    bg: "bg-green-500/20",
    text: "text-green-400",
    border: "border-green-500/30",
    next: "pending",
  },
};

export function TasksTabView({ branch }: TasksTabViewProps) {
  const [plan, setPlan] = useState<PlanJson | null>(null);
  const [loading, setLoading] = useState(true);

  const encodedBranch = encodeURIComponent(branch);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/plan/${encodedBranch}`);
      if (res.ok) {
        const data = await res.json();
        if (data.type === "structured") {
          setPlan(data.plan);
        } else {
          setPlan(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [encodedBranch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStatusChange(stepId: string, current: PlanStepStatus) {
    const nextStatus = STATUS_CONFIG[current].next;
    await fetch(`/api/plan/${encodedBranch}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, status: nextStatus }),
    });
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!plan || plan.steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">작업 목록이 없습니다. Plan 탭에서 플랜을 먼저 생성하세요.</p>
      </div>
    );
  }

  const doneCount = plan.steps.filter(
    (s) => s.status.replace(/-/g, "_") === "done",
  ).length;
  const total = plan.steps.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <div className="p-4">
      {/* Title */}
      <h2 className="text-sm font-semibold text-gray-200 mb-3">{plan.title}</h2>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>진행</span>
          <span>
            {doneCount}/{total} ({Math.round(pct)}%)
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgb(255 255 255 / 0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, rgb(34 197 94 / 0.7), rgb(34 197 94 / 0.9))",
              boxShadow: "0 0 8px rgb(34 197 94 / 0.4)",
            }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-1.5">
        {plan.steps.map((step) => {
          const normalizedStatus = step.status.replace(/-/g, "_") as PlanStepStatus;
          const cfg = STATUS_CONFIG[normalizedStatus] ?? STATUS_CONFIG.pending;

          return (
            <div
              key={step.id}
              className="flex items-center gap-3 glass-card rounded-lg px-4 py-2.5"
            >
              <button
                onClick={() => handleStatusChange(step.id, normalizedStatus)}
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80 transition-opacity`}
                title="클릭하여 상태 변경"
              >
                {cfg.label}
              </button>
              <span
                className={`text-sm ${normalizedStatus === "done" ? "text-gray-500 line-through" : "text-gray-300"}`}
              >
                {step.id}. {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
