/**
 * WindParticlesLayer
 *
 * Canvas-based wind particle visualisation that runs in screen space (the
 * canvas is appended directly to the Leaflet container, not to a pane that
 * gets CSS-transformed on pan/zoom). Particles flow in the real wind direction
 * from the weather API, leave fading trails, and respawn from the upwind edge
 * so the field always looks full.
 *
 * Wind convention: meteorological degrees = direction FROM which wind blows.
 *   → vx = -sin(windRad)   (east component, positive = eastward in canvas)
 *   → vy =  cos(windRad)   (south component, positive = downward in canvas)
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { getWeather } from "../api";
import type { Coords } from "../types";
import { useUnits } from "../hooks/useUnits";

// ─── Particle type ───────────────────────────────────────────────────────────

type Particle = {
  x: number;
  y: number;
  /** Previous position — used to draw a line segment each frame */
  px: number;
  py: number;
  /** Pixels-per-frame speed for this individual particle */
  speed: number;
  age: number;
  maxAge: number;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function spawnParticle(
  w: number,
  h: number,
  vx: number,
  vy: number,
  basePx: number,
  fromEdge: boolean,
): Particle {
  let x: number, y: number;

  if (fromEdge) {
    // Spawn from the upwind edge so particles visibly travel across the screen.
    if (Math.abs(vx) >= Math.abs(vy)) {
      x = vx > 0 ? -8 : w + 8;
      y = Math.random() * h;
    } else {
      x = Math.random() * w;
      y = vy > 0 ? -8 : h + 8;
    }
  } else {
    x = Math.random() * w;
    y = Math.random() * h;
  }

  const speed = basePx * (0.35 + Math.random() * 1.2);
  return {
    x,
    y,
    // Set previous position one step back so the first frame draws a segment.
    px: x - vx * speed,
    py: y - vy * speed,
    speed,
    age: fromEdge ? 0 : Math.random() * 80,
    maxAge: 55 + Math.random() * 90,
  };
}

function isOffCanvas(p: Particle, w: number, h: number) {
  return p.x < -24 || p.x > w + 24 || p.y < -24 || p.y > h + 24;
}

// ─── component ───────────────────────────────────────────────────────────────

export function WindParticlesLayer({
  enabled,
  coords,
}: {
  enabled?: boolean;
  coords: Coords;
}) {
  const map = useMap();
  const { units } = useUnits();
  const rafRef = useRef<number>(0);

  // Same query key as WeatherOverlay → guaranteed React Query cache hit.
  const { data } = useQuery({
    queryKey: ["weather", coords.lat, coords.lon, units],
    queryFn: () => getWeather({ lat: coords.lat, lon: coords.lon, units }),
    staleTime: 5 * 60 * 1000,
    enabled: !!enabled,
  });

  useEffect(() => {
    if (!enabled || !data) return;

    const container = map.getContainer();
    const rect = container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;

    // ── Canvas ────────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    // Append directly to the Leaflet container (position: relative), NOT to a
    // pane. Panes receive a CSS transform on pan/zoom which would shift the
    // canvas; the container div itself never moves.
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:450;";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d")!;

    // ── Wind vector ───────────────────────────────────────────────────────
    const windSpeed = data.current.wind_speed; // m/s (metric) or mph (imperial)
    const windDeg = data.current.wind_deg;
    const windRad = (windDeg * Math.PI) / 180;

    // Particles move AWAY from the source direction.
    const vx = -Math.sin(windRad);
    const vy = Math.cos(windRad);

    // Map wind speed to a comfortable pixel-per-frame range (0.5 – 5.5 px).
    const basePx = Math.max(0.5, Math.min(windSpeed * 0.22, 5.5));

    // ── Particle colour ───────────────────────────────────────────────────
    // Light winds → cool dim blue; strong winds → bright saturated blue-white.
    const speedRatio = Math.min(windSpeed / 20, 1);
    const r = Math.round(150 + speedRatio * 70);
    const g = Math.round(195 + speedRatio * 30);
    const b = 255;

    // ── Particles ─────────────────────────────────────────────────────────
    const PARTICLE_COUNT = 300;
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () =>
      spawnParticle(w, h, vx, vy, basePx, false),
    );

    // ── Render loop ───────────────────────────────────────────────────────
    const render = () => {
      // Semi-transparent overlay fades previous trail segments each frame.
      // Lower alpha = longer, more persistent trails.
      ctx.fillStyle = "rgba(8,12,22,0.10)";
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.age++;

        // Smooth fade-in (0→0.12) and fade-out (0.72→1.0) envelope.
        const t = p.age / p.maxAge;
        const alpha =
          t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1;

        // Line width varies slightly with per-particle speed for depth.
        const lw = 0.85 + (p.speed / basePx) * 0.4;

        ctx.save();
        ctx.globalAlpha = alpha * 0.58;
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();

        // Advance position
        p.px = p.x;
        p.py = p.y;
        p.x += vx * p.speed;
        p.y += vy * p.speed;

        // Respawn from upwind edge once the particle ages out or leaves canvas
        if (p.age > p.maxAge || isOffCanvas(p, w, h)) {
          Object.assign(p, spawnParticle(w, h, vx, vy, basePx, true));
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (container.contains(canvas)) container.removeChild(canvas);
    };
    // Re-run when location/wind data changes or enabled toggles.
  }, [map, enabled, data]);

  return null;
}
