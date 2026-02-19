"use client";

import { useState } from "react";
import { PlanFileEditor } from "./PlanFileEditor";
import type { PlanJson, PlanFile, PlanStepStatus } from "@/lib/types";

interface PlanStructuredViewProps {
  branch: string;
  plan: PlanJson;
  files: PlanFile[];
  onRefresh: () => void;
  onOpenAI?: () => void;
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

export function PlanStructuredView({
  branch,
  plan,
  files,
  onRefresh,
  onOpenAI,
}: PlanStructuredViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const doneCount = plan.steps.filter((s) => s.status.replace(/-/g, "_") === "done").length;
  const total = plan.steps.length;
  const encodedBranch = encodeURIComponent(branch);

  async function handleStatusChange(stepId: string, current: PlanStepStatus) {
    await fetch(`/api/plan/${encodedBranch}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, status: STATUS_CONFIG[current].next }),
    });
    onRefresh();
  }

  async function handleDelete(stepId: string) {
    if (!confirm("이 단계를 삭제하시겠습니까?")) return;
    await fetch(`/api/plan/${encodedBranch}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    });
    onRefresh();
  }

  async function handleSave(filename: string, content: string) {
    await fetch(`/api/plan/${encodedBranch}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content }),
    });
    setEditingId(null);
    onRefresh();
  }

  function getFileForStep(filename: string): PlanFile | undefined {
    return files.find((f) => f.name === filename);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-100">{plan.title}</h2>
        <button
          onClick={onOpenAI}
          disabled={!onOpenAI}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ background: "linear-gradient(135deg, rgb(147 51 234 / 0.5) 0%, rgb(126 34 206 / 0.4) 100%)", border: "1px solid rgb(147 51 234 / 0.3)" }}
        >
          AI로 플랜 만들기
        </button>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>진행</span>
          <span>
            {doneCount}/{total}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgb(255 255 255 / 0.08)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: total > 0 ? `${(doneCount / total) * 100}%` : "0%", background: "linear-gradient(90deg, rgb(34 197 94 / 0.7), rgb(34 197 94 / 0.9))", boxShadow: "0 0 8px rgb(34 197 94 / 0.4)" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-2">
        {plan.steps.map((step) => {
          const normalizedStatus = step.status.replace(/-/g, "_") as PlanStepStatus;
          const cfg = STATUS_CONFIG[normalizedStatus] ?? STATUS_CONFIG.pending;
          const isExpanded = expandedId === step.id;
          const isEditing = editingId === step.id;
          const file = getFileForStep(step.file);

          return (
            <div
              key={step.id}
              className="glass-card rounded-lg overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleStatusChange(step.id, normalizedStatus)}
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80 transition-opacity`}
                    title="클릭하여 상태 변경"
                  >
                    {cfg.label}
                  </button>
                  <span className="text-sm text-gray-200">
                    {step.id}. {step.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : step.id);
                      setEditingId(null);
                    }}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      isExpanded
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "glass-button text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    상세
                  </button>
                  <button
                    onClick={() => handleDelete(step.id)}
                    className="glass-button rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {isExpanded && file && !isEditing && (
                <div className="border-t border-white/10">
                  <div className="flex items-center justify-between px-4 py-2 bg-black/20">
                    <span className="text-xs text-gray-500">{file.name}</span>
                    <button
                      onClick={() => setEditingId(step.id)}
                      className="glass-button rounded px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                  <pre className="px-4 py-3 text-sm text-gray-300 font-mono whitespace-pre-wrap max-h-80 overflow-auto">
                    {file.content}
                  </pre>
                </div>
              )}

              {isExpanded && file && isEditing && (
                <div className="border-t border-white/10 h-80">
                  <PlanFileEditor
                    file={file}
                    onSave={(content) => handleSave(file.name, content)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}

              {isExpanded && !file && (
                <div className="border-t border-white/10 px-4 py-3 text-sm text-gray-500">
                  파일을 찾을 수 없습니다: {step.file}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
