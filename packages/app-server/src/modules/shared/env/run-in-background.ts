export { runInBackground };

// Runs a task after the response without blocking it. On Workers the promise must be
// registered with waitUntil, otherwise the isolate may be torn down before it settles.
function runInBackground(c: any, task: Promise<unknown>, label: string): void {
  const guarded = task.catch((err: unknown) => {
    console.error(`[background] ${label}:`, err);
  });

  try {
    c.executionCtx.waitUntil(guarded);
  } catch {
    // No execution context (Node runtime): the process stays alive, nothing to do.
  }
}
