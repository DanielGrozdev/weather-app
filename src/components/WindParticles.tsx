/**
 * WindParticlesLayer — Fixed for Date Line wrapping and Mercator visual speed consistency.
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useQuery } from "@tanstack/react-query";
import { fetchWindGrid, sampleGrid, type WindGrid } from "../lib/windGrid";

// ── Types ──────────────────────────────────────────────────────────────────────

type Particle = {
  trail: Array<[number, number]>;
  age: number;
  maxAge: number;
  speedMult: number;
};

type Rect = { minLat: number; maxLat: number; minLon: number; maxLon: number };

// ── Constants ──────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 1000;
const TRAIL_LENGTH = 12;
const SPEED_SCALE = 18_000;
const BASE_ZOOM = 6;
const MIN_LIFE_MS = 900;
const MAX_LIFE_MS = 2200;
const MARGIN_PX = 80;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalizes longitude to [-180, 180] */
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

const COLOR_STOPS: [number, number, number, number][] = [
  [0, 50, 136, 189],
  [5, 102, 194, 165],
  [10, 171, 221, 164],
  [15, 230, 245, 152],
  [20, 254, 224, 139],
  [25, 253, 174, 97],
  [30, 213, 62, 79],
];

function speedColor(spd: number): string {
  const s = Math.max(0, Math.min(30, spd));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [s0, r0, g0, b0] = COLOR_STOPS[i];
    const [s1, r1, g1, b1] = COLOR_STOPS[i + 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      return `rgb(${Math.round(r0 + t * (r1 - r0))},${Math.round(g0 + t * (g1 - g0))},${Math.round(b0 + t * (b1 - b0))})`;
    }
  }
  return `rgb(213,62,79)`;
}

function getViewport(map): Rect {
  const b = map.getBounds();
  const minLon = b.getWest();
  let maxLon = b.getEast();

  // Handle crossing the Date Line so random spawning works
  if (maxLon < minLon) maxLon += 360;

  return {
    minLat: b.getSouth(),
    maxLat: b.getNorth(),
    minLon,
    maxLon,
  };
}

function spawnParticle(r: Rect, preAge = false): Particle {
  const lat = r.minLat + Math.random() * (r.maxLat - r.minLat);
  const lon = r.minLon + Math.random() * (r.maxLon - r.minLon);
  const maxAge = MIN_LIFE_MS + Math.random() * (MAX_LIFE_MS - MIN_LIFE_MS);
  return {
    trail: [[lat, lon]],
    age: preAge ? Math.random() * maxAge : 0,
    maxAge,
    speedMult: 0.75 + Math.random() * 0.5,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WindParticlesLayer({
  enabled,
}: {
  enabled?: boolean;
  coords?: { lat: number; lon: number };
}) {
  const { current: map } = useMap();

  const { data: grid } = useQuery({
    queryKey: ["windGrid", "global"],
    queryFn: fetchWindGrid,
    staleTime: Infinity,
    enabled: !!enabled,
  });

  const gridRef = useRef<WindGrid | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (grid) gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    if (!enabled || !map) return;

    const container = map.getContainer();
    const { width: cssW, height: cssH } = container.getBoundingClientRect();
    const W = cssW || 800;
    const H = cssH || 600;
    const dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    if (particlesRef.current.length === 0) {
      const vp0 = getViewport(map);
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        spawnParticle(vp0, true),
      );
    }

    let lastTime = performance.now();
    let rafId = 0;

    const render = (now: number) => {
      const dt = Math.min(now - lastTime, 80);
      lastTime = now;

      ctx.clearRect(0, 0, W, H);
      const g = gridRef.current;
      if (!g) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const vp = getViewport(map);
      const zoom = map.getZoom();

      // Speed factor based on zoom
      const dtScale =
        (dt * SPEED_SCALE) / (1000 * Math.pow(2, zoom - BASE_ZOOM));

      const spawn: Rect = {
        minLat: Math.max(vp.minLat, g.minLat),
        maxLat: Math.min(vp.maxLat, g.maxLat),
        minLon: vp.minLon,
        maxLon: vp.maxLon,
      };

      for (const p of particlesRef.current) {
        p.age += dt;
        const t = p.age / p.maxAge;
        const alpha = t < 0.1 ? t / 0.1 : t > 0.75 ? (1 - t) / 0.25 : 1.0;

        if (alpha <= 0 || p.age >= p.maxAge) {
          Object.assign(p, spawnParticle(spawn));
          continue;
        }

        const [headLat, headLon] = p.trail[0];

        // 1. Wrap longitude for grid sampling
        const { u, v } = sampleGrid(g, headLat, wrapLon(headLon));
        const spd = Math.hypot(u, v);

        // 2. CONSISTENT SPEED MATH:
        // Mercator stretches things by 1/cos(lat).
        // To make a particle move at the same VISUAL speed (pixels/sec),
        // we must multiply the latitude delta by cos(lat).
        const latRad = (headLat * Math.PI) / 180;
        const cosLat = Math.cos(latRad);
        const velocityFactor = (dtScale * p.speedMult) / 111320;

        const newLat = headLat + v * velocityFactor * cosLat;
        const newLon = headLon + u * velocityFactor;

        // 3. Boundary Check
        const headPx = map.project([newLon, newLat]);
        if (
          newLat < g.minLat ||
          newLat > g.maxLat ||
          headPx.x < -MARGIN_PX ||
          headPx.x > W + MARGIN_PX ||
          headPx.y < -MARGIN_PX ||
          headPx.y > H + MARGIN_PX
        ) {
          Object.assign(p, spawnParticle(spawn));
          continue;
        }

        p.trail.unshift([newLat, newLon]);
        if (p.trail.length > TRAIL_LENGTH) p.trail.length = TRAIL_LENGTH;

        // Draw trail
        const n = p.trail.length;
        ctx.save();
        ctx.strokeStyle = speedColor(spd);
        ctx.lineWidth = 1.0 + Math.min(spd / 20, 1) * 1.2;
        ctx.lineCap = "round";

        for (let i = n - 1; i > 0; i--) {
          const p1 = map.project([p.trail[i][1], p.trail[i][0]]);
          const p0 = map.project([p.trail[i - 1][1], p.trail[i - 1][0]]);

          const segFrac = 1 - i / (n - 1);
          ctx.globalAlpha = segFrac * segFrac * alpha * 0.85;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p0.x, p0.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [map, enabled]);

  return null;
}
