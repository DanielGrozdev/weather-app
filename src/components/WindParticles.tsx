/**
 * WindParticlesLayer — vector-field particle visualisation
 *
 * Grid source : Open-Meteo ECMWF IFS 0.25° — 8×8 points, city-centred, fetched ONCE per session
 * Interpolation: bilinear from the 4 surrounding grid cells
 * Particles    : PARTICLE_COUNT points in geographic (lat/lon) space
 * Render loop  : rAF canvas overlay on the MapLibre container
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useQuery } from "@tanstack/react-query";
import {
  cityBoundsFor,
  citySnapFor,
  fetchWindGrid,
  sampleGrid,
  type BoundsRect,
  type WindGrid,
} from "../lib/windGrid";

// ─── Particle type ────────────────────────────────────────────────────────────

type Particle = {
  lat: number;
  lon: number;
  prevLat: number;
  prevLon: number;
  age: number;
  maxAge: number;
  speedMult: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 500;
const DT_BASE = 300;
const BASE_ZOOM = 6;
const MARGIN_PX = 60;

// ─── Windy-inspired speed colormap ───────────────────────────────────────────

const COLOR_STOPS: [number, number, number, number][] = [
  [  0,  50, 136, 189 ],
  [  5, 102, 194, 165 ],
  [ 10, 171, 221, 164 ],
  [ 15, 230, 245, 152 ],
  [ 20, 254, 224, 139 ],
  [ 25, 253, 174,  97 ],
  [ 30, 213,  62,  79 ],
];

function windSpeedColor(spd: number): string {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getViewportBounds(map: any): BoundsRect {
  const b = map.getBounds();
  return {
    minLat: b.getSouth(),
    maxLat: b.getNorth(),
    minLon: b.getWest(),
    maxLon: b.getEast(),
  };
}

function spawnParticle(b: BoundsRect, preAge = false): Particle {
  const lat = b.minLat + Math.random() * (b.maxLat - b.minLat);
  const lon = b.minLon + Math.random() * (b.maxLon - b.minLon);
  const maxAge = 50 + Math.random() * 60;
  return {
    lat, lon, prevLat: lat, prevLon: lon,
    age: preAge ? Math.random() * maxAge : 0,
    maxAge,
    speedMult: 0.75 + Math.random() * 0.3,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type Coords = { lat: number; lon: number };

export function WindParticlesLayer({
  enabled,
  coords,
}: {
  enabled?: boolean;
  coords?: Coords;
}) {
  // useMap() from react-map-gl — works because this component renders inside <Map>
  const { current: map } = useMap();

  // ── Grid fetch — locked to first valid coords, never changes ─────────────
  // Recomputing snap from coords on every render would produce a new query key
  // on every click, fetching a new grid and changing wind direction. Instead we
  // lock the snap on the first render where enabled + coords are both truthy,
  // so the same grid is reused for the entire session regardless of map interaction.

  const lockedSnapRef = useRef<{ lat: number; lon: number } | null>(null);
  if (enabled && coords && !lockedSnapRef.current) {
    lockedSnapRef.current = citySnapFor(coords.lat, coords.lon);
  }
  const snap = lockedSnapRef.current;
  const bounds = snap ? cityBoundsFor(snap.lat, snap.lon) : null;

  const { data: grid } = useQuery({
    queryKey: snap ? ["windGrid", snap.lat, snap.lon] : ["windGrid", "disabled"],
    queryFn: () => fetchWindGrid(bounds!),
    staleTime: 30 * 60 * 1000, // re-fetch after 30 minutes
    gcTime: Infinity,
    enabled: !!enabled && !!snap,
  });

  const gridRef = useRef<WindGrid | null>(null);
  useEffect(() => {
    if (grid) gridRef.current = grid;
  }, [grid]);

  // ── Particle arrays and canvas ref ───────────────────────────────────────

  const particlesRef = useRef<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Render loop ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !map) return;

    const container = map.getContainer();
    const { width: cw, height: ch } = container.getBoundingClientRect();
    const W = cw || 800;
    const H = ch || 600;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:2;";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d")!;

    if (particlesRef.current.length === 0) {
      const vp = getViewportBounds(map);
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        spawnParticle(vp, true),
      );
    }

    const raf = { id: 0 };

    const render = () => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      const g = gridRef.current;
      if (!g) {
        raf.id = requestAnimationFrame(render);
        return;
      }

      const zoom = map.getZoom();
      const dt = DT_BASE / Math.pow(2, zoom - BASE_ZOOM);
      const vp = getViewportBounds(map);

      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
          spawnParticle(vp, true),
        );
      }

      for (const p of particlesRef.current) {
        p.age += 1;

        const t = p.age / p.maxAge;
        const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1;
        if (alpha <= 0) {
          Object.assign(p, spawnParticle(vp));
          continue;
        }

        // MapLibre: project([lon, lat]) — note lon/lat order, opposite of Leaflet
        const prev = map.project([p.prevLon, p.prevLat]);
        const cur  = map.project([p.lon,     p.lat]);

        const { u, v } = sampleGrid(g, p.lat, p.lon);
        const spd = Math.hypot(u, v);

        ctx.save();
        ctx.globalAlpha = alpha * 0.75;
        ctx.strokeStyle = windSpeedColor(spd);
        ctx.lineWidth = 1.0 + Math.min(spd / 15, 1) * 1.0;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
        ctx.restore();

        p.prevLat = p.lat;
        p.prevLon = p.lon;
        const latRad = (p.lat * Math.PI) / 180;
        p.lat += (v * dt * p.speedMult) / 111_320;
        p.lon += (u * dt * p.speedMult) / (111_320 * Math.cos(latRad));

        if (
          p.age > p.maxAge ||
          cur.x < -MARGIN_PX || cur.x > W + MARGIN_PX ||
          cur.y < -MARGIN_PX || cur.y > H + MARGIN_PX
        ) {
          Object.assign(p, spawnParticle(vp));
        }
      }

      raf.id = requestAnimationFrame(render);
    };

    raf.id = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf.id);
      canvasRef.current = null;
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [map, enabled]);

  return null;
}
