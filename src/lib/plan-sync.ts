import fs from "fs";
import path from "path";
import { watch, type FSWatcher } from "chokidar";
import type { ActiveWorktree } from "./types";

const PLAN_BASE = path.resolve(process.cwd(), "plan", "active");
const RULES_FILENAME = "RULES.md";

// Prevent infinite sync loops
let syncing = false;

function withSyncLock(fn: () => void) {
  if (syncing) return;
  syncing = true;
  try {
    fn();
  } finally {
    setTimeout(() => {
      syncing = false;
    }, 500);
  }
}

function generateRules(handlerPlanDir: string, branch: string): string {
  return `# Plan Rules

이 플랜은 worktree 개발 시스템의 플랜입니다.

- 원본 위치: ${handlerPlanDir}
- 브랜치: ${branch}
- 구조: plan.json (인덱스) + *.md (스텝별 명세)
- 플랜 내용을 수정할 경우, 이 디렉토리의 파일을 직접 수정하세요.
  원본은 자동으로 동기화됩니다.
`;
}

function copyDir(src: string, dest: string, excludeFiles: string[] = []) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const srcFiles = new Set(
    fs.readdirSync(src).filter((f) => !f.startsWith(".") && !excludeFiles.includes(f)),
  );
  const destFiles = fs
    .readdirSync(dest)
    .filter((f) => !f.startsWith(".") && !excludeFiles.includes(f));

  // Copy/update files from src
  for (const file of srcFiles) {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    const srcStat = fs.statSync(srcFile);
    if (!srcStat.isFile()) continue;

    const destExists = fs.existsSync(destFile);
    if (!destExists || fs.statSync(destFile).mtimeMs < srcStat.mtimeMs) {
      fs.copyFileSync(srcFile, destFile);
    }
  }

  // Remove files that no longer exist in src
  for (const file of destFiles) {
    if (!srcFiles.has(file)) {
      const destFile = path.join(dest, file);
      if (fs.statSync(destFile).isFile()) {
        fs.unlinkSync(destFile);
      }
    }
  }
}

/** Sync plan/active/{branch}/ → {worktree}/.claude/plan/ + RULES.md */
function syncToWorktree(branch: string, getWorktreePath: (branch: string) => string | null) {
  const wtPath = getWorktreePath(branch);
  if (!wtPath) return;

  const srcDir = path.join(PLAN_BASE, branch);
  const destDir = path.join(wtPath, ".claude", "plan");

  if (!fs.existsSync(srcDir)) return;

  withSyncLock(() => {
    copyDir(srcDir, destDir, [RULES_FILENAME]);

    // Write RULES.md
    const rulesPath = path.join(destDir, RULES_FILENAME);
    fs.writeFileSync(rulesPath, generateRules(srcDir, branch), "utf-8");

    console.log(`[plan-sync] → worktree: ${branch}`);
  });
}

/** Sync {worktree}/.claude/plan/ → plan/active/{branch}/ (excluding RULES.md) */
function syncFromWorktree(branch: string, getWorktreePath: (branch: string) => string | null) {
  const wtPath = getWorktreePath(branch);
  if (!wtPath) return;

  const srcDir = path.join(wtPath, ".claude", "plan");
  const destDir = path.join(PLAN_BASE, branch);

  if (!fs.existsSync(srcDir)) return;

  withSyncLock(() => {
    copyDir(srcDir, destDir, [RULES_FILENAME]);
    console.log(`[plan-sync] ← worktree: ${branch}`);
  });
}

/**
 * Start bidirectional plan sync watchers.
 * Call after server is ready.
 */
export function startPlanSync(
  readActive: () => ActiveWorktree[],
) {
  const watchers: FSWatcher[] = [];

  function getWorktreePath(branch: string): string | null {
    const wt = readActive().find((w) => w.branch === branch);
    return wt?.path ?? null;
  }

  // --- Forward: plan/active/ → worktree .claude/plan/ ---
  let fwdTimer: ReturnType<typeof setTimeout> | null = null;
  const fwdWatcher = watch(PLAN_BASE, {
    persistent: true,
    ignoreInitial: true,
    depth: 2,
  });
  fwdWatcher.on("all", (_event, filePath) => {
    const rel = path.relative(PLAN_BASE, filePath);
    const branch = rel.split(path.sep)[0];
    if (!branch || branch === ".") return;

    if (fwdTimer) clearTimeout(fwdTimer);
    fwdTimer = setTimeout(() => syncToWorktree(branch, getWorktreePath), 1000);
  });
  fwdWatcher.on("error", (err) => console.error("[plan-sync] fwd error:", err));
  watchers.push(fwdWatcher);

  // --- Reverse: worktree .claude/plan/ → plan/active/ ---
  // Watch each active worktree's .claude/plan/ directory
  const reverseWatchers = new Map<string, FSWatcher>();

  function refreshReverseWatchers() {
    const active = readActive();
    const activeBranches = new Set(active.map((w) => w.branch));

    // Remove watchers for no-longer-active worktrees
    for (const [branch, watcher] of reverseWatchers) {
      if (!activeBranches.has(branch)) {
        watcher.close();
        reverseWatchers.delete(branch);
      }
    }

    // Add watchers for new active worktrees
    for (const wt of active) {
      if (reverseWatchers.has(wt.branch)) continue;

      const claudePlanDir = path.join(wt.path, ".claude", "plan");
      fs.mkdirSync(claudePlanDir, { recursive: true });

      let revTimer: ReturnType<typeof setTimeout> | null = null;
      const revWatcher = watch(claudePlanDir, {
        persistent: true,
        ignoreInitial: true,
        depth: 1,
      });
      revWatcher.on("all", (_event, filePath) => {
        if (path.basename(filePath) === RULES_FILENAME) return;
        if (revTimer) clearTimeout(revTimer);
        revTimer = setTimeout(() => syncFromWorktree(wt.branch, getWorktreePath), 1000);
      });
      revWatcher.on("error", (err) =>
        console.error(`[plan-sync] rev error (${wt.branch}):`, err),
      );
      reverseWatchers.set(wt.branch, revWatcher);
    }
  }

  // Initial setup + periodic refresh (picks up new worktrees)
  refreshReverseWatchers();
  setInterval(refreshReverseWatchers, 30000);

  // Initial sync for all active worktrees
  for (const wt of readActive()) {
    const srcDir = path.join(PLAN_BASE, wt.branch);
    if (fs.existsSync(srcDir)) {
      syncToWorktree(wt.branch, getWorktreePath);
    }
  }

  console.log("[plan-sync] Bidirectional plan sync started");
}
