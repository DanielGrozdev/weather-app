import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function WindParticlesLayer({ enabled }: { enabled?: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement("canvas");
    const size = map.getSize();

    canvas.width = size.x;
    canvas.height = size.y;

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "500";

    const pane = map.getPanes().overlayPane;
    pane.appendChild(canvas);

    const ctx = canvas.getContext("2d")!;

    const particles = Array.from({ length: 200 }).map(() => ({
      x: Math.random() * size.x,
      y: Math.random() * size.y,
      vx: 0,
      vy: 0,
    }));

    let frame: number;

    const render = () => {
      ctx.clearRect(0, 0, size.x, size.y);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // simple loop
        if (p.x > size.x) p.x = 0;
        if (p.y > size.y) p.y = 0;

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(p.x, p.y, 2, 2);
      });

      frame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(frame);
      pane.removeChild(canvas);
    };
  }, [map, enabled]);

  return null;
}
