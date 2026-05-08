self.onmessage = async (e) => {
  const { id, url, width, height } = e.data;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const img = await createImageBitmap(blob);

    ctx.drawImage(img, 0, 0, width, height);

    const bitmap = canvas.transferToImageBitmap();

    self.postMessage({ id, bitmap });
  } catch (err) {
    console.log(err);
  }
};
