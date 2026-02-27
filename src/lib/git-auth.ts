import fs from "fs";
import path from "path";
import os from "os";
import type { GitAuthConfig } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const CONFIG_FILE = path.join(DATA_DIR, "git-config.json");
const TOKEN_DIR = path.join(os.homedir(), ".config", ".git-handler");
const TOKEN_FILE = path.join(TOKEN_DIR, ".token");

/* ── Config read / write ────────────────────────────────── */

export function readGitConfig(): GitAuthConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export function writeGitConfig(config: GitAuthConfig): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/* ── Token management ───────────────────────────────────── */

export function loadGitToken(): string | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    return fs.readFileSync(TOKEN_FILE, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

export function saveGitToken(token: string): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, token, { encoding: "utf-8", mode: 0o600 });
  process.env.GIT_TOKEN = token;
}

export function restoreGitToken(): void {
  const token = loadGitToken();
  if (token) {
    process.env.GIT_TOKEN = token;
  }
}

/* ── SSH command helper ─────────────────────────────────── */

export function getSshAddCommand(): string | null {
  const config = readGitConfig();
  if (!config?.sshKeyPath) return null;
  // Expand ~ to home dir
  const keyPath = config.sshKeyPath.replace(/^~/, os.homedir());
  if (!fs.existsSync(keyPath)) return null;
  return `ssh-add ${config.sshKeyPath} 2>/dev/null`;
}
