/**
 * WindParticlesLayer — vector-field particle visualisation
 *
 * Grid source : Open-Meteo ECMWF IFS 0.25° — 8×8 points, city-centred, fetched ONCE per session
 * Interpolation: bilinear from the 4 surrounding grid cells
 * Particles    : PARTICLE_COUNT points in geographic (lat/lon) space
 * Render loop  : rAF canvas overlay, z-index 450 on the Leaflet container
 *
 * Why the grid is city-keyed (not viewport-keyed):
 *   Viewport bounds change with every zoom / pan → new React Query key →
 *   new fetch → direction appears to shift.  By snapping `coords` to the
 *   nearest 5° and building a fixed ±30° / ±35° box around that point, the
 *   same grid covers every zoom level.  staleTime: Infinity means the data
 *   is fetched exactly once per session per 5°-zone and reused forever.
 *
 *   The fetch is gated behind `enabled` so no network request is made when
 *   the wind layer is toggled off.
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
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

const PARTICLE_COUNT = 1000;

/**
 * Simulation seconds per animation frame at BASE_ZOOM.
 * Halves for each zoom level above BASE_ZOOM so visual speed stays constant.
 */
const DT_BASE = 300;
const BASE_ZOOM = 6;
const MARGIN_PX = 60;

// ─── Windy-inspired speed colormap ───────────────────────────────────────────

/**
 * Maps wind speed (m/s) to an RGB colour matching Windy.com's velocity palette:
 *   calm  →  soft blue  →  teal  →  green  →  yellow  →  orange  →  red (storm)
 *
 * Uses linear interpolation between fixed stops so the transition is smooth.
 * The colour is sampled every frame per particle, so it must be cheap.
 */
const COLOR_STOPS: [number, number, number, number][] = [
  //  m/s   R    G    B
  [  0,  50, 136, 189 ],  // calm       — #3288bd
  [  5, 102, 194, 165 ],  // light      — #66c2a5
  [ 10, 171, 221, 164 ],  // moderate   — #abdda4
  [ 15, 230, 245, 152 ],  // fresh      — #e6f598
  [ 20, 254, 224, 139 ],  // strong     — #fee08b
  [ 25, 253, 174,  97 ],  // gale       — #fdae61
  [ 30, 213,  62,  79 ],  // storm      — #d53e4f
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

function getViewportBounds(map: L.Map): BoundsRect {
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
  const maxAge = 80 + Math.random() * 120;
  return {
    lat,
    lon,
    prevLat: lat,
    prevLon: lon,
    age: preAge ? Math.random() * maxAge : 0,
    maxAge,
    speedMult: 0.6 + Math.random() * 0.8,
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
  const map = useMap();

  // ── Grid fetch — city-keyed, once per session ────────────────────────────

  const snap = coords ? citySnapFor(coords.lat, coords.lon) : null;
  const bounds = snap ? cityBoundsFor(snap.lat, snap.lon) : null;

  const { data: grid } = useQuery({
    queryKey: snap
      ? ["windGrid", snap.lat, snap.lon]
      : ["windGrid", "disabled"],
    queryFn: () => fetchWindGrid(bounds!),
    staleTime: Infinity, // never re-fetch during the session
    gcTime: Infinity, // keep in memory as long as the tab is open
    enabled: !!enabled && !!snap,
  });

  // Hold the latest grid in a ref so the rAF loop sees it without restarting.
  const gridRef = useRef<WindGrid | null>(null);
  useEffect(() => {
    if (grid) gridRef.current = grid;
  }, [grid]);

  // ── Particle arrays and canvas ref ───────────────────────────────────────

  const particlesRef = useRef<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * When the selected city changes: clear stale trails and respawn particles
   * across the current viewport so they immediately flow in the new region's
   * direction.  The old grid is kept alive so particles don't freeze while the
   * new fetch resolves.
   */
  useEffect(() => {
    if (!coords) return;
    const vp = getViewportBounds(map);
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      spawnParticle(vp, false),
    );
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [coords?.lat, coords?.lon, map]);

  // ── Render loop ───────────────────────────────────────────────────────────
  // Restarted only when `enabled` or `map` changes — NOT on grid or coord
  // changes — so the animation is never interrupted by data updates.

  useEffect(() => {
    if (!enabled) return;

    const container = map.getContainer();
    const { width: cw, height: ch } = container.getBoundingClientRect();
    const W = cw || 800;
    const H = ch || 600;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:450;";
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
      ctx.fillStyle = "rgba(0,0,0,0.02)";
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

        const prev = map.latLngToContainerPoint([p.prevLat, p.prevLon] as [
          number,
          number,
        ]);
        const cur = map.latLngToContainerPoint([p.lat, p.lon] as [
          number,
          number,
        ]);

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
          cur.x < -MARGIN_PX ||
          cur.x > W + MARGIN_PX ||
          cur.y < -MARGIN_PX ||
          cur.y > H + MARGIN_PX
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
