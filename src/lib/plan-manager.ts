import fs from "fs";
import path from "path";
import type { PlanFile } from "./types";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getActivePlanDir(branch: string): string {
  return path.join(PLAN_DIR, "active", branch);
}

export function getEndedPlanDir(branch: string): string {
  return path.join(PLAN_DIR, "ended", branch);
}

export function listPlanFiles(branch: string): PlanFile[] {
  const dir = getActivePlanDir(branch);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  return files.map((name) => {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    return {
      name,
      path: filePath,
      content: fs.readFileSync(filePath, "utf-8"),
      updatedAt: stat.mtime.toISOString(),
    };
  });
}

export function readPlanFile(branch: string, filename: string): PlanFile | null {
  const filePath = path.join(getActivePlanDir(branch), filename);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    name: filename,
    path: filePath,
    content: fs.readFileSync(filePath, "utf-8"),
    updatedAt: stat.mtime.toISOString(),
  };
}

export function writePlanFile(branch: string, filename: string, content: string): void {
  const dir = getActivePlanDir(branch);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
}

export function copyPlanToWorktree(branch: string, worktreePath: string): void {
  const planDir = getActivePlanDir(branch);
  if (!fs.existsSync(planDir)) return;

  const targetDir = path.join(worktreePath, "plan");
  ensureDir(targetDir);

  const files = fs.readdirSync(planDir).filter((f) => !f.startsWith("."));
  for (const file of files) {
    fs.copyFileSync(path.join(planDir, file), path.join(targetDir, file));
  }
}

export function archivePlan(branch: string): void {
  const activeDir = getActivePlanDir(branch);
  const endedDir = getEndedPlanDir(branch);

  if (!fs.existsSync(activeDir)) return;

  ensureDir(endedDir);
  const files = fs.readdirSync(activeDir).filter((f) => !f.startsWith("."));
  for (const file of files) {
    fs.copyFileSync(path.join(activeDir, file), path.join(endedDir, file));
  }
  fs.rmSync(activeDir, { recursive: true, force: true });
}
