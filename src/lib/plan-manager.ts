import fs from "fs";
import path from "path";
import type { PlanFile } from "./types";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

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
