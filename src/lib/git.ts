import { execSync } from "child_process";
import { env } from "./env";

export interface GitBranch {
  name: string;
  isRemote: boolean;
  lastCommit: string;
}

export interface GitWorktree {
  path: string;
  branch: string;
  head: string;
}

export function listBranches(): GitBranch[] {
  const cwd = env.MAIN_REPO_PATH;
  const raw = execSync("git branch -a --format='%(refname:short)|%(objectname:short)'", {
    cwd,
    encoding: "utf-8",
  });

  const branches: GitBranch[] = [];
  const seen = new Set<string>();

  for (const line of raw.trim().split("\n")) {
    if (!line) continue;
    const [fullName, commit] = line.split("|");
    const isRemote = fullName.startsWith("origin/");
    const name = isRemote ? fullName.replace("origin/", "") : fullName;

    // Skip HEAD pointer and duplicates
    if (name === "HEAD" || name.includes("HEAD")) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    branches.push({
      name,
      isRemote,
      lastCommit: commit || "",
    });
  }

  return branches;
}

export function listWorktrees(): GitWorktree[] {
  const cwd = env.MAIN_REPO_PATH;
  const raw = execSync("git worktree list --porcelain", {
    cwd,
    encoding: "utf-8",
  });

  const worktrees: GitWorktree[] = [];
  let current: Partial<GitWorktree> = {};

  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) worktrees.push(current as GitWorktree);
      current = { path: line.replace("worktree ", "") };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.replace("HEAD ", "");
    } else if (line.startsWith("branch ")) {
      current.branch = line.replace("branch refs/heads/", "");
    }
  }
  if (current.path) worktrees.push(current as GitWorktree);

  return worktrees;
}

export function addWorktree(branch: string, targetPath: string): void {
  const cwd = env.MAIN_REPO_PATH;
  execSync(`git worktree add "${targetPath}" "${branch}"`, {
    cwd,
    encoding: "utf-8",
  });
}

export function removeWorktree(targetPath: string): void {
  const cwd = env.MAIN_REPO_PATH;
  execSync(`git worktree remove "${targetPath}" --force`, {
    cwd,
    encoding: "utf-8",
  });
}