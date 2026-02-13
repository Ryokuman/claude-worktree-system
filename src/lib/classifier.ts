import { execSync } from "child_process";
import { extractTaskNo, resetTTNCounter, branchToTaskName } from "./task-utils";
import { getActive, setActive, setDeactive, addActive } from "./store";
import { env } from "./env";
import type { DeactiveBranch } from "./types";

interface BranchInfo {
  name: string;
  isRemote: boolean;
  lastCommit: string;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

function listBranches(): BranchInfo[] {
  const raw = execSync("git branch -a --format='%(refname:short)|%(objectname:short)'", {
    cwd: env.MAIN_REPO_PATH,
    encoding: "utf-8",
  });

  const branches: BranchInfo[] = [];
  const seen = new Set<string>();

  for (const line of raw.trim().split("\n")) {
    if (!line) continue;
    const [fullName, commit] = line.split("|");
    const isRemote = fullName.startsWith("origin/");
    const name = isRemote ? fullName.replace("origin/", "") : fullName;

    if (name === "HEAD" || name.includes("HEAD")) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    branches.push({ name, isRemote, lastCommit: commit || "" });
  }

  return branches;
}

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
    const active = getActive();
    const activeBranches = new Set(active.map((w) => w.branch));

    // Auto-register existing git worktrees that aren't in active.json
    const mainRepoPath = env.MAIN_REPO_PATH;
    for (const wt of worktrees) {
      if (!wt.branch) continue;
      if (wt.path === mainRepoPath) continue;
      if (activeBranches.has(wt.branch)) continue;

      const taskNo = extractTaskNo(wt.branch);
      const taskName = branchToTaskName(wt.branch);

      addActive({
        taskNo,
        taskName,
        branch: wt.branch,
        path: wt.path,
        port: 0,
        status: "stopped",
        pid: null,
        createdAt: new Date().toISOString().split("T")[0],
      });
      activeBranches.add(wt.branch);
      console.log(`[classifier] Auto-registered existing worktree: ${wt.branch}`);
    }

    // Branches not in active → deactive
    const deactive: DeactiveBranch[] = [];

    for (const branch of branches) {
      if (["main", "master", "develop"].includes(branch.name)) continue;
      if (activeBranches.has(branch.name)) continue;

      deactive.push({
        branch: branch.name,
        taskNo: extractTaskNo(branch.name),
        lastCommit: branch.lastCommit,
        updatedAt: new Date().toISOString().split("T")[0],
      });
    }

    setDeactive(sortDeactive(deactive));

    // Remove active entries whose branches no longer exist
    const allBranchNames = new Set(branches.map((b) => b.name));
    const currentActive = getActive();
    const stillValid = currentActive.filter((w) => allBranchNames.has(w.branch));
    if (stillValid.length !== currentActive.length) {
      setActive(stillValid);
    }
  } catch (err) {
    console.error("[classifier] Error classifying branches:", err);
  }
}
