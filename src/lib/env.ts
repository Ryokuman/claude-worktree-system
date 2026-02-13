import "dotenv/config";

export const env = {
  PROJECT_NAME: process.env.PROJECT_NAME || "MyProject",
  MAIN_REPO_PATH: process.env.MAIN_REPO_PATH || "",
  WORKTREE_BASE_DIR: process.env.WORKTREE_BASE_DIR || "",
  HANDLER_PORT: parseInt(process.env.HANDLER_PORT || "3000", 10),
  PORT_RANGE_START: parseInt(process.env.PORT_RANGE_START || "3001", 10),
  PORT_RANGE_END: parseInt(process.env.PORT_RANGE_END || "3099", 10),
  HEALTHCHECK_INTERVAL: parseInt(
    process.env.HEALTHCHECK_INTERVAL || "10000",
    10
  ),
  HEALTHCHECK_PATH: process.env.HEALTHCHECK_PATH || "/api/healthz",
} as const;

export function validateEnv(): void {
  if (!env.MAIN_REPO_PATH) {
    throw new Error("MAIN_REPO_PATH is required in .env");
  }
  if (!env.WORKTREE_BASE_DIR) {
    throw new Error("WORKTREE_BASE_DIR is required in .env");
  }
}
