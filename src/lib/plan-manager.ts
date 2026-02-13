import fs from "fs";
import path from "path";
import type { PlanFile, PlanJson } from "./types";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

export function readPlanJson(branch: string): PlanJson | null {
  const filePath = path.join(PLAN_DIR, "active", branch, "plan.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function listPlanFiles(branch: string): PlanFile[] {
  const dir = path.join(PLAN_DIR, "active", branch);
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
