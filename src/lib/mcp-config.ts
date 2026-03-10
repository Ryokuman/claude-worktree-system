import fs from "fs";
import path from "path";
import { env } from "./env";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const FILE_PATH = path.join(DATA_DIR, "mcp-config.json");

export interface McpServerConfig {
  enabled: boolean;
  displayName: string;
  command: string;
  args: string[];
  portKey?: string;
  portRangeStart: number;
  portRangeEnd: number;
  options: Record<string, unknown>;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

/** Default MCP config with CDT pre-configured */
export function getDefaultMcpConfig(): McpConfig {
  return {
    servers: {
      cdt: {
        enabled: false,
        displayName: "Chrome DevTools",
        command: "npx",
        args: ["@anthropic-ai/mcp-chrome-devtools@latest"],
        portKey: "--port",
        portRangeStart: 9222,
        portRangeEnd: 9322,
        options: { headless: true },
      },
    },
  };
}

export function readMcpConfig(): McpConfig {
  if (fs.existsSync(FILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
    } catch {
      // Fall through to default
    }
  }
  return getDefaultMcpConfig();
}

export function writeMcpConfig(config: McpConfig): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Calculate a unique MCP port for a worktree based on its app port.
 * Offset: mcpBasePort + (appPort - appPortRangeStart)
 */
function calculateMcpPort(server: McpServerConfig, appPort: number): number {
  const offset = appPort - env.PORT_RANGE_START;
  return server.portRangeStart + offset;
}

/**
 * Generate .mcp.json content for a worktree.
 */
export function generateMcpJson(
  config: McpConfig,
  appPort: number,
): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};

  for (const [key, server] of Object.entries(config.servers)) {
    if (!server.enabled) continue;

    const port = calculateMcpPort(server, appPort);
    const args = [...server.args];

    // Add port argument if portKey is configured
    if (server.portKey) {
      args.push(server.portKey, String(port));
    }

    // Add option flags
    if (server.options.headless) {
      args.push("--headless");
    }

    mcpServers[key] = {
      command: server.command,
      args,
    };
  }

  return { mcpServers };
}

/**
 * Write .mcp.json to a worktree directory.
 * Merges with existing .mcp.json if present (preserves user-defined servers).
 */
export function applyMcpToWorktree(
  worktreePath: string,
  config: McpConfig,
  appPort: number,
): void {
  const enabledCount = Object.values(config.servers).filter(
    (s) => s.enabled,
  ).length;
  if (enabledCount === 0) return;

  const mcpFile = path.join(worktreePath, ".mcp.json");
  let existing: { mcpServers?: Record<string, unknown> } = {};

  if (fs.existsSync(mcpFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(mcpFile, "utf-8"));
    } catch {
      existing = {};
    }
  }

  const generated = generateMcpJson(config, appPort);
  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers || {}),
      ...((generated.mcpServers as Record<string, unknown>) || {}),
    },
  };

  fs.writeFileSync(mcpFile, JSON.stringify(merged, null, 2), "utf-8");
}
