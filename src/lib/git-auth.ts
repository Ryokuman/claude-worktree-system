import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import type { GitAuthConfig } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const CONFIG_FILE = path.join(DATA_DIR, "git-config.json");
const TOKEN_DIR = path.join(os.homedir(), ".config", ".git-handler");
const TOKEN_FILE = path.join(TOKEN_DIR, ".token");
const PASSPHRASE_FILE = path.join(TOKEN_DIR, ".ssh-passphrase");
const ASKPASS_SCRIPT = path.join(TOKEN_DIR, "ssh-askpass.sh");

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

/* ── SSH passphrase management ─────────────────────────── */

/**
 * Save passphrase and immediately register the key in macOS Keychain.
 * Uses SSH_ASKPASS via child_process (no TTY) to provide passphrase,
 * then stores in Keychain via --apple-use-keychain for permanent access.
 */
export function saveSshPassphrase(passphrase: string): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(PASSPHRASE_FILE, passphrase, { encoding: "utf-8", mode: 0o600 });
  const script = `#!/bin/sh\ncat "${PASSPHRASE_FILE}"\n`;
  fs.writeFileSync(ASKPASS_SCRIPT, script, { encoding: "utf-8", mode: 0o755 });

  // Immediately register in macOS Keychain via child_process (no TTY → SSH_ASKPASS works)
  const config = readGitConfig();
  if (config?.sshKeyPath) {
    const keyPath = config.sshKeyPath.replace(/^~/, os.homedir());
    if (fs.existsSync(keyPath)) {
      try {
        execSync(`ssh-add --apple-use-keychain "${keyPath}"`, {
          env: {
            ...process.env,
            SSH_ASKPASS: ASKPASS_SCRIPT,
            SSH_ASKPASS_REQUIRE: "force",
            DISPLAY: ":0",
          },
          stdio: "pipe",
          timeout: 5000,
        });
        console.log("[git-auth] SSH key registered in macOS Keychain");
      } catch (e) {
        console.error("[git-auth] Failed to register SSH key in Keychain:", e);
      }
    }
  }
}

export function hasSshPassphrase(): boolean {
  return fs.existsSync(PASSPHRASE_FILE);
}

/* ── SSH command helper ─────────────────────────────────── */

export function getSshAddCommand(): string | null {
  const config = readGitConfig();
  if (!config?.sshKeyPath) return null;
  const keyPath = config.sshKeyPath.replace(/^~/, os.homedir());
  if (!fs.existsSync(keyPath)) return null;
  return `ssh-add --apple-use-keychain ${config.sshKeyPath} 2>/dev/null`;
}
