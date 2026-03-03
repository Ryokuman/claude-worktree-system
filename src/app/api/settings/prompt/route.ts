import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readJson } from "@/lib/store";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const FILE_PATH = path.join(DATA_DIR, "claude-prompt.json");

const RESERVED_NAMES = ["permissions", "task-prompt"];

interface PromptFile {
  name: string;
  content: string;
}

interface PromptDataV2 {
  files: PromptFile[];
  perWorktree: Record<string, string>;
}

/* ── Migration from V1 format ──────────────────────────── */

function readData(): PromptDataV2 {
  if (!fs.existsSync(FILE_PATH)) return { files: [], perWorktree: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));

    // Already V2
    if (Array.isArray(raw.files)) {
      return { files: raw.files, perWorktree: raw.perWorktree || {} };
    }

    // V1 → V2 migration
    const files: PromptFile[] = [];
    const perWorktree: Record<string, string> = {};

    if (typeof raw.default === "string" && raw.default.trim()) {
      files.push({ name: "custom-prompt", content: raw.default.trim() });
    }
    for (const [key, val] of Object.entries(raw)) {
      if (key !== "default" && typeof val === "string" && val.trim()) {
        perWorktree[key] = (val as string).trim();
      }
    }

    return { files, perWorktree };
  } catch {
    return { files: [], perWorktree: {} };
  }
}

function writeData(data: PromptDataV2): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/* ── Apply to worktrees ────────────────────────────────── */

function applyToWorktrees(data: PromptDataV2): void {
  const active = readJson("active.json") as { taskNo: string; path: string }[];

  for (const wt of active) {
    if (!wt.path) continue;
    const claudeDir = path.join(wt.path, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    // Write each prompt file
    for (const file of data.files) {
      const filePath = path.join(claudeDir, `${file.name}.md`);
      if (file.content.trim()) {
        fs.writeFileSync(filePath, file.content.trim() + "\n", "utf-8");
      } else if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Write per-worktree prompt
    const taskPrompt = data.perWorktree[wt.taskNo];
    const taskPromptPath = path.join(claudeDir, "task-prompt.md");
    if (taskPrompt?.trim()) {
      fs.writeFileSync(taskPromptPath, taskPrompt.trim() + "\n", "utf-8");
    } else if (fs.existsSync(taskPromptPath)) {
      fs.unlinkSync(taskPromptPath);
    }
  }
}

function deleteFileFromWorktrees(name: string): void {
  const active = readJson("active.json") as { taskNo: string; path: string }[];
  for (const wt of active) {
    if (!wt.path) continue;
    const filePath = path.join(wt.path, ".claude", `${name}.md`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/* ── Route handlers ────────────────────────────────────── */

export async function GET() {
  try {
    const data = readData();
    const active = readJson("active.json") as {
      taskNo: string;
      taskName: string;
      path: string;
    }[];
    return NextResponse.json({
      files: data.files,
      perWorktree: data.perWorktree,
      active,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const data = readData();

    switch (body.action) {
      case "saveFile": {
        const name = (body.name as string || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9가-힣-_]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        if (!name) {
          return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }
        if (RESERVED_NAMES.includes(name)) {
          return NextResponse.json(
            { error: `"${name}" is a reserved name` },
            { status: 400 },
          );
        }

        const content = typeof body.content === "string" ? body.content : "";
        const idx = data.files.findIndex((f) => f.name === name);
        if (idx >= 0) {
          data.files[idx].content = content;
        } else {
          data.files.push({ name, content });
        }
        break;
      }

      case "deleteFile": {
        const name = body.name as string;
        const idx = data.files.findIndex((f) => f.name === name);
        if (idx >= 0) {
          data.files.splice(idx, 1);
          deleteFileFromWorktrees(name);
        }
        break;
      }

      case "savePerWorktree": {
        const taskNo = body.taskNo as string;
        const content = (body.content as string || "").trim();
        if (!taskNo) {
          return NextResponse.json({ error: "taskNo is required" }, { status: 400 });
        }
        if (content) {
          data.perWorktree[taskNo] = content;
        } else {
          delete data.perWorktree[taskNo];
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    writeData(data);
    applyToWorktrees(data);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
