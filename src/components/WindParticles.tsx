import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { sampleGrid, type WindGrid } from "../lib/windGrid";
import { useWindGrid } from "../hooks/useWindGrid";
import type { Coords } from "@/types";

const NUM_PARTICLES = 1000;
const BASE_AGE = 300; // base frames before a particle resets
const FADE_ALPHA = 0.78; // per-frame alpha multiplier — higher = longer ghost trail

// ─── Velocity-keyed colour ramp ──────────────────────────────────────────────
// Faster particles are brighter / closer to white-cyan; slower particles sit
// closer to the legend's dim violet base.
const COLOR_STOPS = [
  { max: 1.5, rgb: "200, 230, 250" },
  { max: 4, rgb: "200, 230, 250" },
  { max: 8, rgb: "200, 230, 250" },
  { max: 13, rgb: "200, 230, 250" },
  { max: 19, rgb: "200, 230, 250" },
  { max: Infinity, rgb: "200, 230, 250" },
];

// Ease-in / ease-out: peak in mid-life, fade to 0 at both ends.
const ALPHA_TIERS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

// Tapered width: thin at tail and head, thicker mid-life.
const WIDTH_TIERS = [0.7, 1.5, 2.4];

function speedIdx(speed: number): number {
  for (let k = 0; k < COLOR_STOPS.length; k++) {
    if (speed < COLOR_STOPS[k].max) return k;
  }
  return COLOR_STOPS.length - 1;
}

/** sin(πt) ∈ [0,1] — peak at t=0.5, zero at endpoints. */
function lifeCurve(t: number): number {
  return Math.sin(Math.PI * (t < 0 ? 0 : t > 1 ? 1 : t));
}

function alphaIdx(curve: number): number {
  if (curve < 0.18) return 0;
  if (curve < 0.45) return 1;
  if (curve < 0.75) return 2;
  return 3;
}

function widthIdx(curve: number): number {
  if (curve < 0.33) return 0;
  if (curve < 0.7) return 1;
  return 2;
}

/**
 * Geographic speed factor: degrees moved per (m/s of wind) per frame.
 * Tuned so on-screen pixel speed scales sanely with zoom.
 */
function geoSpeedFactor(zoom: number): number {
  return 0.05 * Math.pow(2, -zoom * 0.7);
}

type State = {
  lat: Float32Array;
  lon: Float32Array;
  age: Float32Array;
  ttl: Float32Array;
  prevX: Float32Array;
  prevY: Float32Array;
  grid: WindGrid | null;
  raf: number;
};

export function WindParticlesLayer({
  enabled,
}: {
  enabled?: boolean;
  coords: Coords;
}) {
  const { current: mapRef } = useMap();
  const stateRef = useRef<State | null>(null);

  const grid = useWindGrid(!!enabled);

  // Keep the grid ref up to date without re-running the main effect
  useEffect(() => {
    if (stateRef.current) stateRef.current.grid = grid ?? null;
  }, [grid]);

  useEffect(() => {
    if (!enabled || !mapRef || !grid) return;

    const map = mapRef.getMap();
    const container = mapRef.getContainer();

    // ── Canvas overlay ────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
    const anchor = container.querySelector(".maplibregl-canvas-container");
    if (anchor?.nextSibling) container.insertBefore(canvas, anchor.nextSibling);
    else container.appendChild(canvas);

    // ── Particle state ────────────────────────────────────────────────────────
    const n = NUM_PARTICLES;
    const state: State = {
      lat: new Float32Array(n),
      lon: new Float32Array(n),
      age: new Float32Array(n),
      ttl: new Float32Array(n),
      prevX: new Float32Array(n).fill(-1),
      prevY: new Float32Array(n).fill(-1),
      grid: grid,
      raf: 0,
    };
    stateRef.current = state;

    // Stratified grid for spawning — avoids clumps, fills the field evenly.
    const STRATA = Math.max(2, Math.ceil(Math.sqrt(n)));

    const getPaddedBounds = () => {
      const b = map.getBounds();
      const pad = 10;
      return {
        west: b.getWest() - pad,
        east: b.getEast() + pad,
        south: Math.max(-85, b.getSouth() - pad),
        north: Math.min(85, b.getNorth() + pad),
      };
    };

    const resetParticle = (i: number) => {
      const b = getPaddedBounds();
      const cellW = (b.east - b.west) / STRATA;
      const cellH = (b.north - b.south) / STRATA;
      const cx = Math.floor(Math.random() * STRATA);
      const cy = Math.floor(Math.random() * STRATA);
      state.lon[i] = b.west + (cx + Math.random()) * cellW;
      state.lat[i] = b.south + (cy + Math.random()) * cellH;
      state.ttl[i] = BASE_AGE * (0.75 + Math.random() * 0.5); // ±25% variety
      state.age[i] = Math.floor(Math.random() * state.ttl[i]);
      state.prevX[i] = -1;
      state.prevY[i] = -1;
    };

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      state.prevX.fill(-1);
      state.prevY.fill(-1);
    };

    resize();
    // Initial stratified placement: one particle per cell, lay it out evenly.
    {
      const b = getPaddedBounds();
      const cellW = (b.east - b.west) / STRATA;
      const cellH = (b.north - b.south) / STRATA;
      for (let i = 0; i < n; i++) {
        const cx = i % STRATA;
        const cy = Math.floor(i / STRATA) % STRATA;
        state.lon[i] = b.west + (cx + Math.random()) * cellW;
        state.lat[i] = b.south + (cy + Math.random()) * cellH;
        state.ttl[i] = BASE_AGE * (0.75 + Math.random() * 0.5);
        state.age[i] = Math.floor(Math.random() * state.ttl[i]);
        state.prevX[i] = -1;
        state.prevY[i] = -1;
      }
    }

    // Pre-allocated sub-buckets: speed × alpha × width.
    const N_C = COLOR_STOPS.length;
    const N_A = ALPHA_TIERS.length;
    const N_W = WIDTH_TIERS.length;
    const SUB_BUCKETS = N_C * N_A * N_W;

    // ── Animation loop ────────────────────────────────────────────────────────
    let lastTs = 0;
    const frame = (ts: number) => {
      state.raf = requestAnimationFrame(frame);

      const dt = lastTs === 0 ? 1 : Math.min(3, (ts - lastTs) / 16.67);
      lastTs = ts;

      const g = state.grid;
      const ctx = canvas.getContext("2d");
      if (!ctx || !g) return;

      const W = canvas.width;
      const H = canvas.height;
      const zoom = map.getZoom();
      const sf = geoSpeedFactor(zoom) * dt;

      // Motion-blur ghosting: scale existing pixel alpha by FADE_ALPHA each
      // frame so prior segments persist briefly and trail off smoothly.
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = `rgba(0,0,0,${FADE_ALPHA})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      // Flat segment arrays per sub-bucket: [x0, y0, x1, y1, ...]
      const buckets: number[][] = new Array(SUB_BUCKETS);
      for (let b = 0; b < SUB_BUCKETS; b++) buckets[b] = [];

      for (let i = 0; i < n; i++) {
        const lat = state.lat[i];
        const lon = state.lon[i];

        // Bilinear sample from the shared wind grid.
        const { u, v } = sampleGrid(g, lat, lon);
        const speed = Math.hypot(u, v);

        // Advance in geographic space (cos-corrected longitude).
        const cosLat = Math.max(0.05, Math.cos((lat * Math.PI) / 180));
        const newLat = lat + v * sf;
        const newLon = lon + (u / cosLat) * sf;

        state.age[i] += dt;
        const t = state.age[i] / state.ttl[i];
        const curve = lifeCurve(t);

        const pt = map.project([newLon, newLat]);
        const px = pt.x,
          py = pt.y;

        const offScreen =
          px < -100 || px > W + 100 || py < -100 || py > H + 100;
        if (t >= 1 || offScreen || newLat < -85 || newLat > 85) {
          resetParticle(i);
          continue;
        }

        const prevX = state.prevX[i];
        const prevY = state.prevY[i];
        state.lat[i] = newLat;
        state.lon[i] = newLon;
        state.prevX[i] = px;
        state.prevY[i] = py;

        if (prevX >= 0 && prevY >= 0) {
          const dx = px - prevX,
            dy = py - prevY;
          // Skip teleport jumps (antimeridian wrap, etc).
          if (dx * dx + dy * dy < 40000) {
            const ci = speedIdx(speed);
            const ai = alphaIdx(curve);
            const wi = widthIdx(curve);
            const key = (ci * N_A + ai) * N_W + wi;
            buckets[key].push(prevX, prevY, px, py);
          }
        }
      }

      // Batched stroke: one path per (colour, alpha, width) bucket.
      ctx.lineCap = "round";
      for (let key = 0; key < SUB_BUCKETS; key++) {
        const segs = buckets[key];
        if (segs.length === 0) continue;
        const wi = key % N_W;
        const ai = Math.floor(key / N_W) % N_A;
        const ci = Math.floor(key / (N_W * N_A));
        ctx.lineWidth = WIDTH_TIERS[wi];
        ctx.strokeStyle = `rgba(${COLOR_STOPS[ci].rgb}, ${ALPHA_TIERS[ai]})`;
        ctx.beginPath();
        for (let s = 0; s < segs.length; s += 4) {
          ctx.moveTo(segs[s], segs[s + 1]);
          ctx.lineTo(segs[s + 2], segs[s + 3]);
        }
        ctx.stroke();
      }
    };

    state.raf = requestAnimationFrame(frame);

    // On pan/zoom end, re-distribute particles that drifted off-screen using
    // the same stratified scheme so the field stays evenly populated.
    const onMoveEnd = () => {
      const b = getPaddedBounds();
      const cellW = (b.east - b.west) / STRATA;
      const cellH = (b.north - b.south) / STRATA;
      for (let i = 0; i < n; i++) {
        const pt = map.project([state.lon[i], state.lat[i]]);
        if (
          pt.x < -200 ||
          pt.x > canvas.width + 200 ||
          pt.y < -200 ||
          pt.y > canvas.height + 200
        ) {
          const cx = Math.floor(Math.random() * STRATA);
          const cy = Math.floor(Math.random() * STRATA);
          state.lon[i] = b.west + (cx + Math.random()) * cellW;
          state.lat[i] = b.south + (cy + Math.random()) * cellH;
          state.age[i] = 0;
          state.prevX[i] = -1;
          state.prevY[i] = -1;
        }
      }
    };

    map.on("moveend", onMoveEnd);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(state.raf);
      map.off("moveend", onMoveEnd);
      window.removeEventListener("resize", resize);
      canvas.remove();
      stateRef.current = null;
    };
  }, [mapRef, enabled, grid]);

  return null;
}
