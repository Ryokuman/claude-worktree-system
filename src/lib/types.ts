export interface ActiveWorktree {
  taskNo: string;
  taskName: string;
  branch: string;
  path: string;
  port: number;
  status: "running" | "stopped" | "starting";
  pid: number | null;
  createdAt: string;
  startedAt?: string;
  hasPlan?: boolean;
  healthCheckPath?: string;
}

export interface DeactiveBranch {
  branch: string;
  taskNo: string;
  lastCommit: string;
  updatedAt: string;
}

export interface EndedWorktree {
  taskNo: string;
  taskName: string;
  branch: string;
  completedAt: string;
}

export interface PlanFile {
  name: string;
  path: string;
  content: string;
  updatedAt: string;
}

export type PlanStepStatus = "pending" | "in_progress" | "done";

export interface PlanStep {
  id: string;
  title: string;
  file: string;
  status: PlanStepStatus;
}

export interface PlanJson {
  title: string;
  steps: PlanStep[];
}

export type PlanResponse =
  | { type: "structured"; plan: PlanJson; files: PlanFile[] }
  | { type: "raw"; files: PlanFile[] }
  | { type: "empty" };

export interface TerminalSession {
  id: string;
  name: string;
  createdAt: number;
}

export type PanelTab = "plan" | "terminal" | "logs" | "tasks" | "git";

export interface GitCommitRaw {
  hash: string;
  parents: string[];
  shortHash: string;
  author: string;
  relativeDate: string;
  message: string;
  refs: string;
}

/** Computed per-row graph layout for SVG rendering */
export interface GraphRow {
  /** Column index of this commit's node */
  col: number;
  /** Total columns at this row */
  totalCols: number;
  /** Vertical pass-through lanes (column indices) */
  passThrough: number[];
  /** Lines from parent columns merging into this node: [fromCol, toCol] */
  mergeLines: [number, number][];
  /** Lines branching from this node to child columns: [fromCol, toCol] */
  branchLines: [number, number][];
}

export interface GitFileChange {
  status: string;
  file: string;
}

export interface GitCommitDetail {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: GitFileChange[];
  diff: string;
}

/** WIP (uncommitted changes) */
export interface WipFile {
  file: string;
  status: string; // "M", "A", "D", "??"
}

export interface WipData {
  staged: WipFile[];
  unstaged: WipFile[];
}

/** Per-file diff response */
export interface FileDiffData {
  file: string;
  diff: string;
}

/** Jira CLI */
export interface JiraCliStatus {
  installed: boolean;
  version?: string;
  configExists: boolean;
}

export interface JiraCliConfig {
  server: string;
  login: string;
  projectKey: string;
  installationType: "cloud" | "local";
  boardId?: string;
}