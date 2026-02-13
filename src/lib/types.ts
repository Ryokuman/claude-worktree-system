export interface ActiveWorktree {
  taskNo: string;
  taskName: string;
  branch: string;
  path: string;
  port: number;
  status: "running" | "stopped";
  pid: number | null;
  createdAt: string;
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