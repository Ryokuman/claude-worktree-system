import { listBranches, listWorktrees } from "./git";
import { extractTaskNo } from "./task-utils";
import { store } from "./store";
import type { DeactiveBranch } from "./types";

export function classifyBranches(): void {
  try {
    const branches = listBranches();
    const worktrees = listWorktrees();
    const active = store.getActive();

    const activeBranches = new Set(active.map((w) => w.branch));
    const worktreeBranches = new Set(worktrees.map((w) => w.branch));

    // Branches not in active.json → deactive
    const deactive: DeactiveBranch[] = [];

    for (const branch of branches) {
      // Skip main/master/develop
      if (["main", "master", "develop"].includes(branch.name)) continue;
      // Skip if already active
      if (activeBranches.has(branch.name)) continue;

      deactive.push({
        branch: branch.name,
        taskNo: extractTaskNo(branch.name),
        lastCommit: branch.lastCommit,
        updatedAt: new Date().toISOString().split("T")[0],
      });
    }

    store.setDeactive(deactive);

    // Remove active entries whose branches no longer exist
    const allBranchNames = new Set(branches.map((b) => b.name));
    const currentActive = store.getActive();
    const stillValid = currentActive.filter((w) => allBranchNames.has(w.branch));
    if (stillValid.length !== currentActive.length) {
      store.setActive(stillValid);
    }
  } catch (err) {
    console.error("[classifier] Error classifying branches:", err);
  }
}
