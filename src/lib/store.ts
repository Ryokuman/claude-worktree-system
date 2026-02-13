import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readJson<T>(filename: string): T[] {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function writeJson<T>(filename: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}
