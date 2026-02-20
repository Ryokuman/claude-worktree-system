/**
 * Per-worktree in-memory mutex lock.
 *
 * Prevents concurrent start/stop operations on the same worktree,
 * which can cause multiple dev server processes to be spawned (TOCTOU race).
 *
 * Uses globalThis to survive Next.js dev-mode module re-evaluation.
 */

const globalLocks = (globalThis as any).__taskLocks ??= new Map<string, Promise<void>>();

/**
 * Acquire a lock for the given key (typically taskNo).
 * If a lock is already held, waits for it to release before proceeding.
 * Returns a release function that MUST be called when done.
 */
export async function acquireTaskLock(
  taskNo: string,
): Promise<() => void> {
  while (globalLocks.has(taskNo)) {
    await globalLocks.get(taskNo);
  }

  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  globalLocks.set(taskNo, promise);

  return () => {
    globalLocks.delete(taskNo);
    release();
  };
}

/**
 * Execute a function while holding the lock for the given taskNo.
 * Ensures only one operation runs at a time per worktree.
 */
export async function withTaskLock<T>(
  taskNo: string,
  fn: () => Promise<T>,
): Promise<T> {
  const release = await acquireTaskLock(taskNo);
  try {
    return await fn();
  } finally {
    release();
  }
}
