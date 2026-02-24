import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import type { JiraCliStatus, JiraCliConfig } from "./types";

const CONFIG_DIR = path.join(os.homedir(), ".config", ".jira");
const CONFIG_FILE = path.join(CONFIG_DIR, ".config.yml");
const TOKEN_FILE = path.join(CONFIG_DIR, ".token");

/* ── Installation check ─────────────────────────────────── */

export function checkInstallation(): JiraCliStatus {
  try {
    execSync("which jira", { encoding: "utf-8", stdio: "pipe" });
    let version: string | undefined;
    try {
      version = execSync("jira version", {
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();
    } catch {
      // version command may fail even if binary exists
    }
    return {
      installed: true,
      version,
      configExists: fs.existsSync(CONFIG_FILE),
    };
  } catch {
    return { installed: false, configExists: false };
  }
}

/* ── Config read / write ────────────────────────────────── */

export function readConfig(): JiraCliConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;

  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const lines = content.split("\n");

    let server = "";
    let login = "";
    let projectKey = "";
    let installationType: "cloud" | "local" = "cloud";
    let boardId: string | undefined;

    // Simple state-machine YAML parser for known nested keys
    let section = "";
    for (const raw of lines) {
      const line = raw.trimEnd();

      // Top-level key (no leading whitespace)
      if (/^\S/.test(line)) {
        const m = line.match(/^(\w+)\s*:\s*(.*)/);
        if (!m) continue;
        const [, key, val] = m;
        section = key;
        const v = val.trim();
        if (key === "server" && v) server = v;
        if (key === "login" && v) login = v;
        if (key === "installation" && v) installationType = v as typeof installationType;
        continue;
      }

      // Nested key (indented)
      const nested = line.match(/^\s+(\w+)\s*:\s*(.*)/);
      if (!nested) continue;
      const [, nk, nv] = nested;
      const val = nv.trim();

      if (section === "project" && nk === "key") projectKey = val;
      if (section === "project" && nk === "type" && (val === "cloud" || val === "local")) {
        installationType = val;
      }
      if (section === "board" && nk === "id") boardId = val || undefined;
    }

    if (!server || !login || !projectKey) return null;

    return { server, login, projectKey, installationType, boardId };
  } catch {
    return null;
  }
}

export function writeConfig(
  config: JiraCliConfig,
  apiToken?: string,
): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const lines = [
    `installation: ${config.installationType}`,
    `server: ${config.server}`,
    `login: ${config.login}`,
    `project:`,
    `  key: ${config.projectKey}`,
    `  type: classic`,
  ];

  if (config.boardId) {
    lines.push(`board:`, `  id: ${config.boardId}`, `  type: scrum`);
  }

  lines.push(`epic:`, `  name: Epic Name`, `  link: Epic Link`);

  fs.writeFileSync(CONFIG_FILE, lines.join("\n") + "\n", "utf-8");

  if (apiToken) {
    saveApiToken(apiToken);
  }
}

/* ── API Token ──────────────────────────────────────────── */

export function loadApiToken(): string | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    return fs.readFileSync(TOKEN_FILE, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

export function saveApiToken(token: string): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(TOKEN_FILE, token, { encoding: "utf-8", mode: 0o600 });
  process.env.JIRA_API_TOKEN = token;
}

/**
 * Call once on server startup to restore JIRA_API_TOKEN into process.env
 */
export function restoreApiToken(): void {
  const token = loadApiToken();
  if (token) {
    process.env.JIRA_API_TOKEN = token;
  }
}
