import { getActive, getEnded } from "./store";

const DV_PATTERN = /DV-(\d+)/i;

let ttnCounter = 0;

export function resetTTNCounter(): void {
  // Only count active/ended (persistent). Deactive is rebuilt each time.
  const all = [
    ...getActive().map((w) => w.taskNo),
    ...getEnded().map((w) => w.taskNo),
  ];

  const existingTTNs = all
    .filter((t) => t.startsWith("TTN-"))
    .map((t) => parseInt(t.replace("TTN-", ""), 10))
    .filter((n) => !isNaN(n));

  ttnCounter = existingTTNs.length > 0 ? Math.max(...existingTTNs) : 0;
}

export function extractTaskNo(branch: string): string {
  const match = branch.match(DV_PATTERN);
  if (match) {
    return `DV-${match[1]}`;
  }
  ttnCounter++;
  return `TTN-${ttnCounter}`;
}

export function branchToTaskName(branch: string): string {
  let name = branch
    .replace(/^(feat|fix|hotfix|release|chore|refactor|docs)\//i, "")
    .replace(DV_PATTERN, "")
    .replace(/^-+|-+$/g, "")
    .replace(/-/g, " ")
    .trim();

  if (!name) {
    name = branch.replace(/\//g, " ").trim();
  }

  return name;
}
