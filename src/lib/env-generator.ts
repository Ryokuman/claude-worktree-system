import fs from "fs";
import path from "path";
import { env } from "./env";

export interface EnvEntry {
  key: string;
  value: string;
}

export interface EnvTemplate {
  source: ".env" | ".env.example";
  overrides: Record<string, string>;
}

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const TEMPLATE_FILE = path.join(DATA_DIR, "env-template.json");

/** Parse a .env file string into key-value entries */
export function parseEnv(content: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ key, value });
  }
  return entries;
}

/** Serialize entries back to .env format */
export function serializeEnv(entries: EnvEntry[]): string {
  return entries.map((e) => `${e.key}=${e.value}`).join("\n") + "\n";
}

/** Read the main repo .env or .env.example */
export function readMainRepoEnv(): { entries: EnvEntry[]; source: string } | null {
  for (const filename of [".env", ".env.example"]) {
    const filePath = path.join(env.MAIN_REPO_PATH, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return { entries: parseEnv(content), source: filename };
    }
  }
  return null;
}

/** Read the env template config */
export function readEnvTemplate(): EnvTemplate {
  if (fs.existsSync(TEMPLATE_FILE)) {
    return JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf-8"));
  }
  return { source: ".env", overrides: {} };
}

/** Save the env template config */
export function writeEnvTemplate(template: EnvTemplate): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(template, null, 2), "utf-8");
}

/** Apply template overrides and placeholder substitution */
export function generateEnv(
  baseEntries: EnvEntry[],
  overrides: Record<string, string>,
  vars: Record<string, string>,
): EnvEntry[] {
  const result = baseEntries.map((e) => ({ ...e }));

  // Apply overrides
  for (const [key, tplValue] of Object.entries(overrides)) {
    const existing = result.find((e) => e.key === key);
    const resolved = substitutePlaceholders(tplValue, vars);
    if (existing) {
      existing.value = resolved;
    } else {
      result.push({ key, value: resolved });
    }
  }

  return result;
}

/** Replace {{PLACEHOLDER}} patterns in a string */
function substitutePlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

/** Read a worktree's .env file */
export function readWorktreeEnv(worktreePath: string): EnvEntry[] | null {
  const envPath = path.join(worktreePath, ".env");
  if (!fs.existsSync(envPath)) return null;
  return parseEnv(fs.readFileSync(envPath, "utf-8"));
}

/** Write a worktree's .env file */
export function writeWorktreeEnv(worktreePath: string, entries: EnvEntry[]): void {
  fs.writeFileSync(path.join(worktreePath, ".env"), serializeEnv(entries), "utf-8");
}
