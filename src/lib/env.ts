import fs from "fs";
import path from "path";

// Parse .env file manually (no dotenv dependency needed)
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

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
