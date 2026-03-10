import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "work-trees");
const FILE_PATH = path.join(DATA_DIR, "auto-feedback.json");

export interface AutoFeedbackConfig {
  enabled: boolean;
  prompt: string;
  perWorktree?: Record<
    string,
    {
      enabled?: boolean;
      prompt?: string;
    }
  >;
}

const DEFAULT_CONFIG: AutoFeedbackConfig = {
  enabled: false,
  prompt: "",
  perWorktree: {},
};

export function readAutoFeedbackConfig(): AutoFeedbackConfig {
  if (fs.existsSync(FILE_PATH)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(FILE_PATH, "utf-8")) };
    } catch {
      // Fall through
    }
  }
  return { ...DEFAULT_CONFIG };
}

export function writeAutoFeedbackConfig(config: AutoFeedbackConfig): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get the effective feedback config for a specific worktree.
 * Per-worktree settings override global settings.
 */
export function getEffectiveConfig(
  taskNo: string,
): { enabled: boolean; prompt: string } {
  const config = readAutoFeedbackConfig();
  const perWt = config.perWorktree?.[taskNo];

  if (!perWt) {
    return { enabled: config.enabled, prompt: config.prompt };
  }

  return {
    enabled: perWt.enabled ?? config.enabled,
    prompt: perWt.prompt || config.prompt,
  };
}
