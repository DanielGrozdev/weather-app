const cache = new Map();

self.onmessage = async (e) => {
  const { id, url } = e.data;

  try {
    let img = cache.get(url);

    if (!img) {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      img = await createImageBitmap(blob);

      // Memory Management
      if (cache.size > 200) {
        const firstKey = cache.keys().next().value;
        const oldImg = cache.get(firstKey);
        if (oldImg) oldImg.close(); // Crucial: free GPU memory
        cache.delete(firstKey);
      }

      cache.set(url, img);
    }

    /**
     * We don't use 'transferables' here because we want to KEEP the
     * image in the worker cache. If we transferred it, the worker
     * would lose it. The browser will handle the copy efficiently.
     */
    self.postMessage({ id, bitmap: img });
  } catch (err) {
    console.error(err);
    self.postMessage({ id, bitmap: null });
  }
};
