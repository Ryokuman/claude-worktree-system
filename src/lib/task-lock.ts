/**
 * Per-worktree in-memory mutex lock.
 *
 * Prevents concurrent start/stop operations on the same worktree,
 * which can cause multiple dev server processes to be spawned (TOCTOU race).
 */

const locks = new Map<string, Promise<void>>();

/**
 * Acquire a lock for the given key (typically taskNo).
 * If a lock is already held, waits for it to release before proceeding.
 * Returns a release function that MUST be called when done.
 */
export async function acquireTaskLock(
  taskNo: string,
): Promise<() => void> {
  // Wait for any existing lock to release
  while (locks.has(taskNo)) {
    await locks.get(taskNo);
  }

  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  locks.set(taskNo, promise);

  return () => {
    locks.delete(taskNo);
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
