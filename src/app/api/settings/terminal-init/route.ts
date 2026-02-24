import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const FILE_PATH = path.join(DATA_DIR, "terminal-init.json");

interface TerminalInitData {
  default: string[];
  [taskNo: string]: string[];
}

function readData(): TerminalInitData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    return { default: [] };
  }
  return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
}

function writeData(data: TerminalInitData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/settings/terminal-init
 * Query: ?taskNo=X (optional, returns specific + default)
 * Without taskNo: returns all data
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskNo = searchParams.get("taskNo");
  const data = readData();

  if (taskNo) {
    // Return merged commands: default + worktree-specific
    const defaultCmds = data.default || [];
    const worktreeCmds = data[taskNo] || [];
    return NextResponse.json({
      default: defaultCmds,
      commands: worktreeCmds,
      merged: [...defaultCmds, ...worktreeCmds],
    });
  }

  return NextResponse.json(data);
}

/**
 * PUT /api/settings/terminal-init
 * Body: { taskNo?: string, commands: string[] }
 * If taskNo is omitted or "default", updates default commands
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { taskNo, commands } = body as {
      taskNo?: string;
      commands: string[];
    };

    if (!Array.isArray(commands)) {
      return NextResponse.json(
        { error: "commands must be an array" },
        { status: 400 },
      );
    }

    const data = readData();
    const key = taskNo && taskNo !== "default" ? taskNo : "default";

    // Remove empty commands, trim whitespace
    const cleaned = commands.map((c: string) => c.trim()).filter(Boolean);

    if (cleaned.length === 0) {
      // Remove key if empty (except default)
      if (key === "default") {
        data.default = [];
      } else {
        delete data[key];
      }
    } else {
      data[key] = cleaned;
    }

    writeData(data);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
