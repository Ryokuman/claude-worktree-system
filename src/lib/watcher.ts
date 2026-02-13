import { watch } from "chokidar";
import path from "path";
import { env } from "./env";
import { classifyBranches } from "./classifier";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedClassify() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log("[watcher] Git change detected, classifying branches...");
    classifyBranches();
  }, 2000);
}

export function initWatcher(): void {
  const gitDir = path.join(env.MAIN_REPO_PATH, ".git");
  const refsPath = path.join(gitDir, "refs");

  console.log("[watcher] Watching git refs at:", refsPath);

  // Initial classification
  classifyBranches();

  const watcher = watch(refsPath, {
    persistent: true,
    ignoreInitial: true,
    depth: 5,
  });

  watcher.on("all", (_event, _path) => {
    debouncedClassify();
  });

  watcher.on("error", (err) => {
    console.error("[watcher] Error:", err);
  });
}
