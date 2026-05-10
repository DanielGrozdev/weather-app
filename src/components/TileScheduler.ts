type Task = {
  key: string;
  priority: number;
  run: () => Promise<void>;
};

class TileScheduler {
  private queue: Task[] = [];
  private running = 0;
  // Match the worker pool size — each slot maps to one worker decode thread
  private maxConcurrent = 8;
  private aborted = new Set<string>();

  add(task: Task) {
    // A new add() supersedes any prior cancel() for the same key
    this.aborted.delete(task.key);

    // Deduplicate — if the same tile is already queued, replace with updated priority
    this.queue = this.queue.filter((t) => t.key !== task.key);

    this.queue.push(task);
    // Sort descending — highest priority runs first
    this.queue.sort((a, b) => b.priority - a.priority);

    this.tick();
  }

  cancel(key: string) {
    this.aborted.add(key);
    // Also remove from queue immediately (no need to run it)
    this.queue = this.queue.filter((t) => t.key !== key);
  }

  /** Reset all aborted state — call when the layer URL changes. */
  reset() {
    this.aborted.clear();
    this.queue = [];
  }

  private async tick() {
    if (this.running >= this.maxConcurrent) return;

    const task = this.queue.shift();
    if (!task) return;

    if (this.aborted.has(task.key)) {
      this.aborted.delete(task.key);
      return this.tick();
    }

    this.running++;

    try {
      await task.run();
    } finally {
      this.running--;
      this.tick();
    }
  }
}

export const tileScheduler = new TileScheduler();
