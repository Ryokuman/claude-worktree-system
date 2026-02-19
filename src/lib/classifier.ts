import { execSync } from "child_process";
import { extractTaskNo, resetTTNCounter, branchToTaskName } from "./task-utils";
import { readJson, writeJson } from "./store";
import type { ActiveWorktree } from "./types";
import { env } from "./env";
import type { DeactiveBranch } from "./types";

interface BranchInfo {
  name: string;
  lastCommit: string;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

/** 리모트 이름 목록 */
function getRemoteNames(): string[] {
  try {
    const raw = execSync("git remote", {
      cwd: env.MAIN_REPO_PATH,
      encoding: "utf-8",
    });
    return raw.trim().split("\n").filter(Boolean);
  } catch {
    return ["origin"];
  }
}

/** 리모트 브랜치만 가져온다 (리모트 접두사 제거) */
function listBranches(): BranchInfo[] {
  const raw = execSync(
    "git branch -r --format='%(refname:short)|%(objectname:short)'",
    { cwd: env.MAIN_REPO_PATH, encoding: "utf-8" },
  );

  const remotes = getRemoteNames();
  const branches: BranchInfo[] = [];
  const seen = new Set<string>();

  for (const line of raw.trim().split("\n")) {
    if (!line) continue;
    const [fullName, commit] = line.split("|");

    // Strip remote prefix (dynamos/feat/... → feat/...)
    let name = fullName;
    for (const remote of remotes) {
      if (fullName.startsWith(remote + "/")) {
        name = fullName.slice(remote.length + 1);
        break;
      }
    }

    if (name === "HEAD" || name.includes("HEAD")) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    branches.push({ name, lastCommit: commit || "" });
  }

  return branches;
}

/** git worktree list 로 실제 워크트리 목록 조회 */
function listWorktrees(): WorktreeInfo[] {
  const raw = execSync("git worktree list --porcelain", {
    cwd: env.MAIN_REPO_PATH,
    encoding: "utf-8",
  });

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) worktrees.push(current as WorktreeInfo);
      current = { path: line.replace("worktree ", "") };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.replace("HEAD ", "");
    } else if (line.startsWith("branch ")) {
      current.branch = line.replace("branch refs/heads/", "");
    }
  }
  if (current.path) worktrees.push(current as WorktreeInfo);

  return worktrees;
}

function sortDeactive(list: DeactiveBranch[]): DeactiveBranch[] {
  return list.sort((a, b) => {
    const aIsTTN = a.taskNo.startsWith("TTN-");
    const bIsTTN = b.taskNo.startsWith("TTN-");

    if (aIsTTN && !bIsTTN) return -1;
    if (!aIsTTN && bIsTTN) return 1;

    const aNum = parseInt(a.taskNo.replace(/^(TTN|DV)-/, ""), 10);
    const bNum = parseInt(b.taskNo.replace(/^(TTN|DV)-/, ""), 10);
    return aNum - bNum;
  });
}

export function classifyBranches(): void {
  try {
    resetTTNCounter();

    const branches = listBranches();
    const worktrees = listWorktrees();

    // Source of truth: git worktree list (실제 파일시스템)
    const mainRepoPath = env.MAIN_REPO_PATH;
    const worktreeBranches = new Set<string>();

    for (const wt of worktrees) {
      if (!wt.branch) continue;
      if (wt.path === mainRepoPath) continue;
      worktreeBranches.add(wt.branch);
    }

    // Auto-register worktrees not in active.json
    const active = readJson<ActiveWorktree>("active.json");
    const activeBranches = new Set(active.map((w) => w.branch));

    for (const wt of worktrees) {
      if (!wt.branch) continue;
      if (wt.path === mainRepoPath) continue;
      if (activeBranches.has(wt.branch)) continue;

      active.push({
        taskNo: extractTaskNo(wt.branch),
        taskName: branchToTaskName(wt.branch),
        branch: wt.branch,
        path: wt.path,
        port: 0,
        status: "stopped",
        pid: null,
        createdAt: new Date().toISOString().split("T")[0],
      });
      activeBranches.add(wt.branch);
      console.log(
        `[classifier] Auto-registered existing worktree: ${wt.branch}`,
      );
    }

    // Remove active entries whose worktree no longer exists
    const stillValid = active.filter((w) => worktreeBranches.has(w.branch));
    writeJson("active.json", stillValid);

    // Deactive = remote branches - worktree branches - main/master/develop
    const deactive: DeactiveBranch[] = [];

    for (const branch of branches) {
      if (worktreeBranches.has(branch.name)) continue;

      deactive.push({
        branch: branch.name,
        taskNo: extractTaskNo(branch.name),
        lastCommit: branch.lastCommit,
        updatedAt: new Date().toISOString().split("T")[0],
      });
    }

    writeJson("deactive.json", sortDeactive(deactive));
  } catch (err) {
    console.error("[classifier] Error classifying branches:", err);
  }
}
