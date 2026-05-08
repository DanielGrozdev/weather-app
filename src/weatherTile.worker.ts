const cache = new Map<string, ImageBitmap>();

self.onmessage = async (e) => {
  const { id, url, width, height } = e.data;

  const cacheKey = url;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  try {
    let img = cache.get(cacheKey);

    if (!img) {
      const res = await fetch(url);
      const blob = await res.blob();
      img = await createImageBitmap(blob);
      cache.set(cacheKey, img);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const bitmap = canvas.transferToImageBitmap();

    self.postMessage({ id, bitmap });
  } catch (err) {
    console.log(err);
  }
};
