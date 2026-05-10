class LRUCache<T> {
  private max = 512;
  private map = new Map<string, T>();

  get(k: string): T | null {
    const v = this.map.get(k);
    if (v === undefined) return null;

    // Move to end (most-recently-used)
    this.map.delete(k);
    this.map.set(k, v);

    return v;
  }

  /** Peek without affecting LRU order. */
  peek(k: string): T | null {
    return this.map.get(k) ?? null;
  }

  set(k: string, v: T) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);

    if (this.map.size > this.max) {
      // Evict least-recently-used (first entry)
      const first = this.map.keys().next().value;
      if (first !== undefined) {
        const evicted = this.map.get(first) as ImageBitmap | undefined;
        // Release GPU memory for evicted ImageBitmaps
        if (evicted && typeof (evicted as ImageBitmap).close === "function") {
          (evicted as ImageBitmap).close();
        }
        this.map.delete(first);
      }
    }
  }

  has(k: string): boolean {
    return this.map.has(k);
  }
}

export const tileCache = new LRUCache<ImageBitmap>();
