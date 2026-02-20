import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "work-trees", "logs");

export function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getLogPath(taskNo: string): string {
  return path.join(LOG_DIR, `${taskNo}.log`);
}

export function clearLog(taskNo: string): void {
  const logPath = getLogPath(taskNo);
  if (fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "");
  }
}

export function removeLog(taskNo: string): void {
  const logPath = getLogPath(taskNo);
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}
