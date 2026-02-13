import fs from "fs";
import path from "path";
import type { ActiveWorktree, DeactiveBranch, EndedWorktree } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filename: string): T[] {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson<T>(filename: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

// --- Active ---

export const getActive = () => readJson<ActiveWorktree>("active.json");

export const setActive = (data: ActiveWorktree[]) =>
  writeJson("active.json", data);

export function addActive(worktree: ActiveWorktree) {
  const list = getActive();
  list.push(worktree);
  setActive(list);
}

export function updateActive(taskNo: string, updates: Partial<ActiveWorktree>) {
  const list = getActive();
  const worktree = list.find((w) => w.taskNo === taskNo);
  if (!worktree) return undefined;
  Object.assign(worktree, updates);
  setActive(list);
  return worktree;
}

// --- Deactive ---

export const getDeactive = () => readJson<DeactiveBranch>("deactive.json");

export const setDeactive = (data: DeactiveBranch[]) =>
  writeJson("deactive.json", data);

// --- Ended ---

export const getEnded = () => readJson<EndedWorktree>("ended.json");

export const setEnded = (data: EndedWorktree[]) =>
  writeJson("ended.json", data);
