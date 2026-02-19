"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  GitCommitRaw,
  GraphRow,
  GitCommitDetail,
  WipFile,
} from "@/lib/types";

interface GitTabViewProps {
  branch: string;
}

type GitAction = "push" | "pull" | "fetch";

/* ── Lane colors (GitKraken-inspired palette) ── */

const LANE_COLORS = [
  "#22c55e", // green
  "#60a5fa", // blue
  "#facc15", // yellow
  "#c084fc", // purple
  "#22d3ee", // cyan
  "#f87171", // red
  "#fb923c", // orange
  "#a78bfa", // violet
  "#34d399", // emerald
  "#f472b6", // pink
];

/* ── Graph layout computation ── */

function computeGraphLayout(
  commits: GitCommitRaw[],
): { rows: GraphRow[]; maxCols: number } {
  const lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];
  let maxCols = 0;

  for (let ci = 0; ci < commits.length; ci++) {
    const commit = commits[ci];

    let col = lanes.indexOf(commit.hash);
    if (col === -1) {
      col = lanes.indexOf(null);
      if (col === -1) {
        col = lanes.length;
        lanes.push(commit.hash);
      } else {
        lanes[col] = commit.hash;
      }
    }

    const passThrough: number[] = [];
    const mergeLines: [number, number][] = [];
    const branchLines: [number, number][] = [];

    for (let l = 0; l < lanes.length; l++) {
      if (l !== col && lanes[l] !== null) {
        passThrough.push(l);
      }
    }

    lanes[col] = null;

    const parents = commit.parents;
    for (let pi = 0; pi < parents.length; pi++) {
      const parentHash = parents[pi];
      const existingLane = lanes.indexOf(parentHash);

      if (pi === 0) {
        if (existingLane !== -1 && existingLane !== col) {
          mergeLines.push([col, existingLane]);
        } else {
          lanes[col] = parentHash;
        }
      } else {
        if (existingLane !== -1) {
          mergeLines.push([existingLane, col]);
        } else {
          let newLane = lanes.indexOf(null);
          if (newLane === -1) {
            newLane = lanes.length;
            lanes.push(parentHash);
          } else {
            lanes[newLane] = parentHash;
          }
          branchLines.push([col, newLane]);
        }
      }
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
    }

    const totalCols = Math.max(lanes.length, col + 1);
    if (totalCols > maxCols) maxCols = totalCols;

    rows.push({ col, totalCols, passThrough, mergeLines, branchLines });
  }

  return { rows, maxCols };
}

/* ── SVG Graph Row (Bezier curves + glow nodes) ── */

const ROW_H = 32;
const COL_W = 18;
const NODE_R = 5;
const GLOW_R = 10;

function laneX(lane: number): number {
  return lane * COL_W + COL_W / 2 + 6;
}

function GraphSvg({
  row,
  maxCols,
  isWip,
  isSelected,
}: {
  row: GraphRow;
  maxCols: number;
  isWip?: boolean;
  isSelected?: boolean;
}) {
  const w = Math.max(maxCols * COL_W + 16, 50);
  const midY = ROW_H / 2;
  const cx = laneX(row.col);
  const color = LANE_COLORS[row.col % LANE_COLORS.length];

  return (
    <svg
      width={w}
      height={ROW_H}
      className="shrink-0 select-none"
      style={{ minWidth: w }}
    >
      <defs>
        {/* Glow filter */}
        <filter id={`glow-${row.col}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Pass-through vertical lines */}
      {row.passThrough.map((lane) => {
        const x = laneX(lane);
        return (
          <line
            key={`pt-${lane}`}
            x1={x}
            y1={0}
            x2={x}
            y2={ROW_H}
            stroke={LANE_COLORS[lane % LANE_COLORS.length]}
            strokeWidth={2}
            opacity={0.5}
          />
        );
      })}

      {/* This commit's vertical line */}
      <line
        x1={cx}
        y1={0}
        x2={cx}
        y2={ROW_H}
        stroke={color}
        strokeWidth={2}
        opacity={0.5}
      />

      {/* Merge lines (bezier curves) */}
      {row.mergeLines.map(([from, to], i) => {
        const x1 = laneX(from);
        const x2 = laneX(to);
        const cp1y = midY;
        const cp2y = ROW_H;
        return (
          <path
            key={`ml-${i}`}
            d={`M ${x1} ${midY} C ${x1} ${cp1y + (ROW_H - midY) * 0.5}, ${x2} ${cp2y - (ROW_H - midY) * 0.5}, ${x2} ${ROW_H}`}
            stroke={LANE_COLORS[to % LANE_COLORS.length]}
            strokeWidth={2}
            fill="none"
            opacity={0.5}
          />
        );
      })}

      {/* Branch lines (bezier curves) */}
      {row.branchLines.map(([from, to], i) => {
        const x1 = laneX(from);
        const x2 = laneX(to);
        return (
          <path
            key={`bl-${i}`}
            d={`M ${x1} ${midY} C ${x1} ${midY + (ROW_H - midY) * 0.5}, ${x2} ${ROW_H - (ROW_H - midY) * 0.5}, ${x2} ${ROW_H}`}
            stroke={LANE_COLORS[to % LANE_COLORS.length]}
            strokeWidth={2}
            fill="none"
            opacity={0.5}
          />
        );
      })}

      {/* Glow circle (behind the node) */}
      <circle
        cx={cx}
        cy={midY}
        r={isSelected ? GLOW_R + 2 : GLOW_R}
        fill={color}
        opacity={isSelected ? 0.3 : 0.15}
      />

      {/* Commit node */}
      {isWip ? (
        // WIP node: dashed ring
        <circle
          cx={cx}
          cy={midY}
          r={NODE_R}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      ) : (
        <circle
          cx={cx}
          cy={midY}
          r={NODE_R}
          fill={color}
          stroke="#0d1117"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

/* ── Ref badge (lane-colored) ── */

function RefBadge({ ref, laneColor }: { ref: string; laneColor: string }) {
  const r = ref.trim();
  const isHead = r.startsWith("HEAD ->");
  const isTag = r.startsWith("tag:");
  const isRemote = r.includes("/");

  // Background is a dimmed version of the lane color
  const bgOpacity = isHead ? 0.25 : 0.15;
  const borderOpacity = isHead ? 0.5 : 0.3;

  return (
    <span
      className="inline-flex rounded border px-1.5 text-[10px] font-medium font-mono mr-1 leading-[18px] shrink-0"
      style={{
        backgroundColor: `${laneColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, "0")}`,
        borderColor: `${laneColor}${Math.round(borderOpacity * 255).toString(16).padStart(2, "0")}`,
        color: laneColor,
      }}
    >
      {isTag && "🏷 "}
      {isRemote && !isHead ? "↗ " : ""}
      {r}
    </span>
  );
}

/* ── Diff view ── */

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="text-[11px] leading-[18px] overflow-x-auto">
      {diff.split("\n").map((line, i) => {
        let cls = "text-gray-400";
        if (line.startsWith("+") && !line.startsWith("+++"))
          cls = "text-green-400 bg-green-500/8";
        else if (line.startsWith("-") && !line.startsWith("---"))
          cls = "text-red-400 bg-red-500/8";
        else if (line.startsWith("@@")) cls = "text-cyan-400/70";
        else if (line.startsWith("diff ")) cls = "text-gray-500 font-bold";
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

/* ── File status icon ── */

function fileStatusStyle(status: string): { color: string; label: string } {
  switch (status) {
    case "A":
    case "??":
      return { color: "text-green-400", label: "A" };
    case "D":
      return { color: "text-red-400", label: "D" };
    case "R":
      return { color: "text-yellow-400", label: "R" };
    default:
      return { color: "text-blue-300", label: "M" };
  }
}

/* ── Detail Panel (right split) ── */

function DetailPanel({
  detail,
  detailLoading,
  wipData,
  wipLoading,
  selectedFile,
  onFileSelect,
  isWip,
  onClose,
  encodedBranch,
  selectedHash,
}: {
  detail: GitCommitDetail | null;
  detailLoading: boolean;
  wipData: { staged: WipFile[]; unstaged: WipFile[]; stagedDiff: string; unstagedDiff: string } | null;
  wipLoading: boolean;
  selectedFile: string | null;
  onFileSelect: (file: string | null) => void;
  isWip: boolean;
  onClose: () => void;
  encodedBranch: string;
  selectedHash: string | null;
}) {
  const [fileDiff, setFileDiff] = useState<string | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState(false);

  // Fetch per-file diff when a file is selected (commit mode only)
  useEffect(() => {
    if (!selectedFile || isWip || !selectedHash) {
      setFileDiff(null);
      return;
    }
    setFileDiffLoading(true);
    fetch(
      `/api/git/${encodedBranch}/show?hash=${selectedHash}&file=${encodeURIComponent(selectedFile)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFileDiff(data.diff);
      })
      .finally(() => setFileDiffLoading(false));
  }, [selectedFile, isWip, selectedHash, encodedBranch]);

  if (isWip) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 shrink-0">
          <div className="text-sm font-medium text-gray-200">
            Working Changes
          </div>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        {wipLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-gray-500 text-sm">Loading...</span>
          </div>
        ) : wipData ? (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Staged files */}
            {wipData.staged.length > 0 && (
              <div>
                <div className="text-[10px] text-green-400 uppercase tracking-wider mb-2 font-medium">
                  Staged ({wipData.staged.length})
                </div>
                <div className="space-y-0.5">
                  {wipData.staged.map((f, j) => {
                    const st = fileStatusStyle(f.status);
                    const isActive = selectedFile === `staged:${f.file}`;
                    return (
                      <button
                        key={j}
                        onClick={() =>
                          onFileSelect(isActive ? null : `staged:${f.file}`)
                        }
                        className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          isActive
                            ? "bg-white/8 text-gray-200"
                            : "text-gray-400 hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className={`${st.color} font-bold w-3`}>
                          {st.label}
                        </span>
                        <span className="truncate">{f.file}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unstaged files */}
            {wipData.unstaged.length > 0 && (
              <div>
                <div className="text-[10px] text-orange-400 uppercase tracking-wider mb-2 font-medium">
                  Unstaged ({wipData.unstaged.length})
                </div>
                <div className="space-y-0.5">
                  {wipData.unstaged.map((f, j) => {
                    const st = fileStatusStyle(f.status);
                    const isActive = selectedFile === `unstaged:${f.file}`;
                    return (
                      <button
                        key={j}
                        onClick={() =>
                          onFileSelect(isActive ? null : `unstaged:${f.file}`)
                        }
                        className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          isActive
                            ? "bg-white/8 text-gray-200"
                            : "text-gray-400 hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className={`${st.color} font-bold w-3`}>
                          {st.label}
                        </span>
                        <span className="truncate">{f.file}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Diff */}
            {selectedFile ? (
              <div className="glass-card rounded-lg overflow-auto max-h-80 p-3">
                <DiffView
                  diff={
                    selectedFile.startsWith("staged:")
                      ? wipData.stagedDiff
                      : wipData.unstagedDiff
                  }
                />
              </div>
            ) : (
              wipData.unstagedDiff || wipData.stagedDiff ? (
                <div className="glass-card rounded-lg overflow-auto max-h-80 p-3">
                  <DiffView diff={wipData.stagedDiff || wipData.unstagedDiff} />
                </div>
              ) : null
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // Commit detail mode
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 shrink-0">
        <div className="min-w-0">
          {detail && (
            <>
              <div className="text-sm font-medium text-gray-200 truncate">
                {detail.message.split("\n")[0]}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {detail.author} · {detail.date}
              </div>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-300 shrink-0 ml-2"
        >
          &times;
        </button>
      </div>

      {detailLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-500 text-sm">Loading...</span>
        </div>
      ) : detail ? (
        <div className="flex-1 overflow-auto">
          {/* Full message (if multiline) */}
          {detail.message.includes("\n") && (
            <div className="px-4 py-3 text-xs text-gray-300 whitespace-pre-wrap border-b border-white/6">
              {detail.message}
            </div>
          )}

          {/* Files */}
          {detail.files.length > 0 && (
            <div className="px-4 py-3 border-b border-white/6">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Files ({detail.files.length})
              </div>
              <div className="space-y-0.5">
                {detail.files.map((f, j) => {
                  const st = fileStatusStyle(f.status);
                  const isActive = selectedFile === f.file;
                  return (
                    <button
                      key={j}
                      onClick={() =>
                        onFileSelect(isActive ? null : f.file)
                      }
                      className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        isActive
                          ? "bg-white/8 text-gray-200"
                          : "text-gray-400 hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className={`${st.color} font-bold w-3`}>
                        {st.label}
                      </span>
                      <span className="truncate">{f.file}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Diff */}
          <div className="p-4">
            {fileDiffLoading ? (
              <div className="text-xs text-gray-500">Loading diff...</div>
            ) : (
              <div className="glass-card rounded-lg overflow-auto max-h-[50vh] p-3">
                <DiffView diff={selectedFile && fileDiff ? fileDiff : detail.diff} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Main Component ── */

export function GitTabView({ branch }: GitTabViewProps) {
  const [commits, setCommits] = useState<GitCommitRaw[]>([]);
  const [hasWip, setHasWip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<GitAction | null>(null);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Selection
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [isWipSelected, setIsWipSelected] = useState(false);

  // Detail panel data
  const [detail, setDetail] = useState<GitCommitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [wipData, setWipData] = useState<{
    staged: WipFile[];
    unstaged: WipFile[];
    stagedDiff: string;
    unstagedDiff: string;
  } | null>(null);
  const [wipLoading, setWipLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const encodedBranch = encodeURIComponent(branch);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/git/${encodedBranch}/log`);
      if (res.ok) {
        const data = await res.json();
        setCommits(data.commits ?? []);
        setHasWip(data.hasWip ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, [encodedBranch]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const { rows, maxCols } = useMemo(
    () => computeGraphLayout(commits),
    [commits],
  );

  // Show detail panel?
  const showDetail = selectedHash !== null || isWipSelected;

  function handleSelectCommit(hash: string) {
    if (selectedHash === hash) {
      setSelectedHash(null);
      setDetail(null);
      setSelectedFile(null);
      return;
    }
    setIsWipSelected(false);
    setSelectedHash(hash);
    setDetail(null);
    setSelectedFile(null);
    setDetailLoading(true);
    fetch(`/api/git/${encodedBranch}/show?hash=${hash}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDetail(data);
      })
      .finally(() => setDetailLoading(false));
  }

  function handleSelectWip() {
    if (isWipSelected) {
      setIsWipSelected(false);
      setWipData(null);
      setSelectedFile(null);
      return;
    }
    setSelectedHash(null);
    setIsWipSelected(true);
    setWipData(null);
    setSelectedFile(null);
    setWipLoading(true);
    fetch(`/api/git/${encodedBranch}/wip`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setWipData(data);
      })
      .finally(() => setWipLoading(false));
  }

  function handleCloseDetail() {
    setSelectedHash(null);
    setIsWipSelected(false);
    setDetail(null);
    setWipData(null);
    setSelectedFile(null);
  }

  async function handleAction(action: GitAction) {
    setActionLoading(action);
    setActionResult(null);
    try {
      const res = await fetch(`/api/git/${encodedBranch}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionResult({
          type: "success",
          message: data.output || `${action} completed`,
        });
        fetchLog();
      } else {
        setActionResult({
          type: "error",
          message: data.output || data.error || `${action} failed`,
        });
      }
    } catch {
      setActionResult({ type: "error", message: `${action} failed` });
    } finally {
      setActionLoading(null);
    }
  }

  // WIP pseudo-row for graph
  const wipRow: GraphRow | null = hasWip
    ? {
        col: 0,
        totalCols: maxCols || 1,
        passThrough: [],
        mergeLines: [],
        branchLines: [],
      }
    : null;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/6 shrink-0">
        {(["fetch", "pull", "push"] as GitAction[]).map((action) => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={actionLoading !== null}
            className="glass-button rounded px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50"
          >
            {actionLoading === action
              ? "..."
              : action.charAt(0).toUpperCase() + action.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={fetchLog}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          ↻
        </button>
      </div>

      {/* Action result */}
      {actionResult && (
        <div
          className={`mx-4 mt-2 rounded px-3 py-2 text-xs font-mono shrink-0 ${
            actionResult.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {actionResult.message}
          <button
            onClick={() => setActionResult(null)}
            className="ml-2 text-gray-500 hover:text-gray-300"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main content: graph list + detail panel */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Commit log */}
        <div
          className={`overflow-auto min-h-0 transition-all duration-200 ${
            showDetail ? "w-1/2 border-r border-white/6" : "w-full"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-500 text-sm">Loading...</span>
            </div>
          ) : commits.length === 0 && !hasWip ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-500 text-sm">
                No commits
              </span>
            </div>
          ) : (
            <div>
              {/* WIP row */}
              {hasWip && wipRow && (
                <div
                  className={`flex items-center cursor-pointer transition-colors ${
                    isWipSelected ? "bg-white/6" : "hover:bg-white/[0.03]"
                  }`}
                  style={{ height: ROW_H }}
                  onClick={handleSelectWip}
                >
                  <GraphSvg
                    row={wipRow}
                    maxCols={maxCols || 1}
                    isWip
                    isSelected={isWipSelected}
                  />
                  <span className="shrink-0 font-mono text-[12px] text-orange-400/80 mr-2">
                    ●●●●●●●
                  </span>
                  <span className="inline-flex rounded border border-orange-400/30 bg-orange-500/15 px-1.5 text-[10px] font-medium font-mono mr-1 leading-[18px] text-orange-400 shrink-0">
                    WIP
                  </span>
                  <span className="text-[12px] text-gray-400 italic truncate mr-3 font-mono">
                    Uncommitted changes
                  </span>
                </div>
              )}

              {/* Commit rows */}
              {commits.map((commit, i) => {
                const row = rows[i];
                if (!row) return null;

                const refs = commit.refs
                  ? commit.refs
                      .split(",")
                      .map((r) => r.trim())
                      .filter(Boolean)
                  : [];
                const isSelected = selectedHash === commit.hash;
                const laneColor =
                  LANE_COLORS[row.col % LANE_COLORS.length];

                return (
                  <div
                    key={commit.hash}
                    className={`flex items-center cursor-pointer transition-colors ${
                      isSelected ? "bg-white/6" : "hover:bg-white/[0.03]"
                    }`}
                    style={{ height: ROW_H }}
                    onClick={() => handleSelectCommit(commit.hash)}
                  >
                    {/* SVG graph */}
                    <GraphSvg
                      row={row}
                      maxCols={maxCols}
                      isSelected={isSelected}
                    />

                    {/* Hash */}
                    <span className="shrink-0 font-mono text-[12px] text-yellow-500/80 mr-2">
                      {commit.shortHash}
                    </span>

                    {/* Refs (lane-colored) */}
                    {refs.map((ref, j) => (
                      <RefBadge key={j} ref={ref} laneColor={laneColor} />
                    ))}

                    {/* Message */}
                    <span className="text-[12px] text-gray-300 truncate mr-3 font-mono">
                      {commit.message}
                    </span>

                    {/* Author · date */}
                    <span className="shrink-0 ml-auto text-[11px] text-gray-600 whitespace-nowrap pr-4 pl-4 font-mono">
                      {commit.author} · {commit.relativeDate}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {showDetail && (
          <div className="w-1/2 min-h-0 overflow-hidden">
            <DetailPanel
              detail={detail}
              detailLoading={detailLoading}
              wipData={wipData}
              wipLoading={wipLoading}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
              isWip={isWipSelected}
              onClose={handleCloseDetail}
              encodedBranch={encodedBranch}
              selectedHash={selectedHash}
            />
          </div>
        )}
      </div>
    </div>
  );
}
