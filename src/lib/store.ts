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
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJson<T>(filename: string, data: T[]): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

class Store {
  private active: ActiveWorktree[] = [];
  private deactive: DeactiveBranch[] = [];
  private ended: EndedWorktree[] = [];
  private loaded = false;

  load() {
    if (this.loaded) return;
    this.active = readJson<ActiveWorktree>("active.json");
    this.deactive = readJson<DeactiveBranch>("deactive.json");
    this.ended = readJson<EndedWorktree>("ended.json");
    this.loaded = true;
  }

  getActive(): ActiveWorktree[] {
    this.load();
    return this.active;
  }

  getDeactive(): DeactiveBranch[] {
    this.load();
    return this.deactive;
  }

  getEnded(): EndedWorktree[] {
    this.load();
    return this.ended;
  }

  setActive(data: ActiveWorktree[]) {
    this.active = data;
    writeJson("active.json", data);
  }

  setDeactive(data: DeactiveBranch[]) {
    this.deactive = data;
    writeJson("deactive.json", data);
  }

  setEnded(data: EndedWorktree[]) {
    this.ended = data;
    writeJson("ended.json", data);
  }

  addActive(worktree: ActiveWorktree) {
    this.load();
    this.active.push(worktree);
    writeJson("active.json", this.active);
  }

  removeActive(taskNo: string): ActiveWorktree | undefined {
    this.load();
    const idx = this.active.findIndex((w) => w.taskNo === taskNo);
    if (idx === -1) return undefined;
    const [removed] = this.active.splice(idx, 1);
    writeJson("active.json", this.active);
    return removed;
  }

  updateActive(taskNo: string, updates: Partial<ActiveWorktree>) {
    this.load();
    const worktree = this.active.find((w) => w.taskNo === taskNo);
    if (worktree) {
      Object.assign(worktree, updates);
      writeJson("active.json", this.active);
    }
    return worktree;
  }

  addEnded(item: EndedWorktree) {
    this.load();
    this.ended.push(item);
    writeJson("ended.json", this.ended);
  }

  reload() {
    this.loaded = false;
    this.load();
  }
}

export const store = new Store();
