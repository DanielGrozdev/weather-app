/**
 * WindParticlesLayer — vector-field particle visualisation
 *
 * Grid source : Open-Meteo (free, no key) — 3×3 points centered on coords
 * Interpolation: bilinear from the 4 surrounding grid cells
 * Particles    : PARTICLE_COUNT points in geographic (lat/lon) space
 * Render loop  : rAF canvas overlay, z-index 450 on the Leaflet container
 *
 * Consistency guarantee:
 *   coordsBoundsFor() places the center grid cell at exactly (coords.lat, lon).
 *   sampleGrid at that point returns the raw Open-Meteo value — the same number
 *   shown by useWindAtPoint in the overlay.  Both consumers share the React Query
 *   cache entry ["windGrid", minLat, maxLat, minLon, maxLon].
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import {
  coordsBoundsFor,
  fetchWindGrid,
  sampleGrid,
  stableBounds,
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

const PARTICLE_COUNT = 1400;

/**
 * Simulation seconds per animation frame at BASE_ZOOM.
 * Halves for each zoom level above BASE_ZOOM so visual speed stays constant.
 */
const DT_BASE = 300;
const BASE_ZOOM = 6;
const MARGIN_PX = 60;

// ─── Map bounds helper ────────────────────────────────────────────────────────

function getMapBounds(map: L.Map): BoundsRect {
  const b = map.getBounds();
  return {
    minLat: b.getSouth(),
    maxLat: b.getNorth(),
    minLon: b.getWest(),
    maxLon: b.getEast(),
  };
}

// ─── Particle factory ─────────────────────────────────────────────────────────

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

  // ── Grid fetching ─────────────────────────────────────────────────────────

  /**
   * coordsBoundsFor keeps the center cell at exactly (coords.lat, coords.lon)
   * — no stableBounds shift.  Coords is already rounded to 2 dp upstream so
   * the query key is naturally stable without extra snapping.
   */
  const coordsBounds = useMemo<BoundsRect | null>(
    () => (coords ? coordsBoundsFor(coords.lat, coords.lon) : null),
    [coords?.lat, coords?.lon],
  );

  /** Map-viewport bounds — only updated from event handlers (no setState in effects). */
  const [mapBounds, setMapBounds] = useState<BoundsRect>(() =>
    stableBounds(getMapBounds(map)),
  );

  useMapEvents({
    moveend: () => setMapBounds(stableBounds(getMapBounds(map))),
    zoomend: () => setMapBounds(stableBounds(getMapBounds(map))),
  });

  // coordsBounds wins so the center cell matches coords exactly.
  // mapBounds covers the particle field when the user pans away.
  const activeBounds = coordsBounds ?? mapBounds;

  const { data: grid } = useQuery({
    queryKey: [
      "windGrid",
      activeBounds.minLat,
      activeBounds.maxLat,
      activeBounds.minLon,
      activeBounds.maxLon,
    ],
    queryFn: () => fetchWindGrid(activeBounds),
    staleTime: 10 * 60 * 1000,
    enabled: !!enabled,
  });

  // Swap the grid reference without restarting the render loop so particles
  // continue uninterrupted while new data loads.
  const gridRef = useRef<WindGrid | null>(null);
  useEffect(() => {
    if (grid) gridRef.current = grid;
  }, [grid]);

  // ── Refs shared between the flush effect and the render loop ──────────────

  const particlesRef = useRef<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * When coords change (new city / map click):
   *   - Immediately respawn all particles in the current viewport at age=0 so
   *     they fade in at the new location.  We deliberately keep the old grid
   *     so particles start moving right away (slightly wrong direction for ~0.5s)
   *     rather than freezing until the new grid arrives.
   *   - Clear the canvas so stale trails from the previous location vanish instantly.
   */
  useEffect(() => {
    if (!coords) return;
    const visB = getMapBounds(map);
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      spawnParticle(visB, false),
    );
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [coords, coords.lat, coords.lon, map]);

  // ── Render loop — only restarted when enabled/map changes ────────────────

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

    // Seed on first mount (pre-aged so the field looks full immediately).
    if (particlesRef.current.length === 0) {
      const initB = getMapBounds(map);
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        spawnParticle(initB, true),
      );
    }

    const raf = { id: 0 };

    const render = () => {
      // Long dreamy trails: erase only 4% of canvas alpha per frame.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      const g = gridRef.current;
      if (!g) {
        raf.id = requestAnimationFrame(render);
        return;
      }

      const zoom = map.getZoom();
      const dt = DT_BASE / Math.pow(2, zoom - BASE_ZOOM);
      const visB = getMapBounds(map);

      // Re-seed (shouldn't normally be empty here, but guards against races).
      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
          spawnParticle(visB, true),
        );
      }

      for (const p of particlesRef.current) {
        p.age += 1;

        const t = p.age / p.maxAge;
        const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1;
        if (alpha <= 0) {
          Object.assign(p, spawnParticle(visB));
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

        const ratio = Math.min(spd / 15, 1);
        const rCh = Math.round(110 + ratio * 145);
        const gCh = Math.round(160 + ratio * 95);

        ctx.save();
        ctx.globalAlpha = alpha * 0.65;
        ctx.strokeStyle = `rgb(${rCh},${gCh},255)`;
        ctx.lineWidth = 0.75 + ratio * 0.75;
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
          Object.assign(p, spawnParticle(visB));
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
