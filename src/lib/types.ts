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

export interface TerminalSession {
  id: string;
  pid: number;
  cwd: string;
  createdAt: string;
}
