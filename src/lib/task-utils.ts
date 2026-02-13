import { store } from "./store";

const DV_PATTERN = /DV-(\d+)/i;

export function extractTaskNo(branch: string): string {
  const match = branch.match(DV_PATTERN);
  if (match) {
    return `DV-${match[1]}`;
  }
  return generateTTN();
}

function generateTTN(): string {
  const active = store.getActive();
  const ended = store.getEnded();

  const existingTTNs = [...active, ...ended]
    .map((w) => w.taskNo)
    .filter((t) => t.startsWith("TTN-"))
    .map((t) => parseInt(t.replace("TTN-", ""), 10))
    .filter((n) => !isNaN(n));

  const maxTTN = existingTTNs.length > 0 ? Math.max(...existingTTNs) : 0;
  return `TTN-${maxTTN + 1}`;
}

export function branchToTaskName(branch: string): string {
  // Remove common prefixes
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
