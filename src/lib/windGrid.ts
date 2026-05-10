/**
 * Shared wind-grid utilities — WindParticlesLayer + useWindAtPoint.
 *
 * Fetch strategy (once per session, per city zone):
 *   Wind data is keyed by CITY LOCATION, not viewport.  The selected city's
 *   lat/lon is snapped to the nearest 5° so nearby cities share the same cache
 *   entry.  The grid covers ±30° lat / ±35° lon around that snapped centre —
 *   wide enough to contain any zoom level — and is fetched exactly ONCE per
 *   browser session (staleTime: Infinity in both consumers).
 *
 *   Consequences:
 *   • Zooming / panning never triggers a new fetch → direction never changes.
 *   • Switching to a new city fires exactly one new request.
 *   • The entire session needs at most N requests where N = number of distinct
 *     5°-zones visited.
 *   • Both consumers (particles + overlay) hit the same React Query key →
 *     single network call shared between them.
 *
 * Batch API:
 *   All grid points are sent in ONE Open-Meteo request using comma-separated
 *   latitude/longitude arrays.  8×8 = 64 points → good directional resolution
 *   (~7.5° spacing) while staying well under the free-tier limit.
 *   With staleTime:Infinity the request fires at most ONCE per session per
 *   city zone, so the ECMWF IFS 0.25° model is safe to use — it gives the
 *   closest match to Windy.com which also uses ECMWF data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** u = eastward m/s component, v = northward m/s component */
export type WindPoint = { lat: number; lon: number; u: number; v: number };

export type BoundsRect = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export type WindGrid = {
  points: WindPoint[];
  rows: number;
  cols: number;
  bounds: BoundsRect;
};

// ─── Grid constants ───────────────────────────────────────────────────────────

/**
 * 8×8 = 64 points.  Covers ±30° lat / ±35° lon at ~7.5° × 8.75° spacing
 * (~830 km).  This resolution faithfully captures synoptic-scale features
 * (fronts, jet streams, cyclones) that are visible at zoom 4–8 — the same
 * scales Windy.com shows with its ECMWF data — without triggering rate
 * limits (64-point batch, fetched once per session).
 */
export const GRID_ROWS = 8;
export const GRID_COLS = 8;

/** Degrees to snap lat/lon to when computing the cache key. */
const SNAP = 5;

/** Half-extents of the grid bounding box around the snapped city centre. */
const HALF_LAT = 30;
const HALF_LON = 35;

// ─── Key helpers ──────────────────────────────────────────────────────────────

/**
 * Snap a lat/lon to the nearest `SNAP`-degree grid point.
 * Two locations within the same 5° cell return the same snapped value →
 * same React Query key → shared cache entry.
 */
export function citySnapFor(lat: number, lon: number): { lat: number; lon: number } {
  return {
    lat: Math.round(lat / SNAP) * SNAP,
    lon: Math.round(lon / SNAP) * SNAP,
  };
}

/**
 * Bounding box for a snapped city centre.  Always covers ±30° lat / ±35° lon,
 * which is large enough to contain the viewport at any zoom level (zoom 2 =
 * full world; zoom 6 ≈ 40° × 60°; zoom 10+ = city scale).
 */
export function cityBoundsFor(snappedLat: number, snappedLon: number): BoundsRect {
  return {
    minLat: Math.max(-90, snappedLat - HALF_LAT),
    maxLat: Math.min(90, snappedLat + HALF_LAT),
    minLon: snappedLon - HALF_LON,
    maxLon: snappedLon + HALF_LON,
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch wind data for a GRID_ROWS × GRID_COLS lattice covering `b` in a
 * single batched Open-Meteo request.
 *
 * Uses models=ecmwf_ifs025 (same model as Windy.com) for the most accurate
 * direction match.  With staleTime:Infinity this fires at most once per
 * session per city zone, so there is no rate-limit risk.
 */
export async function fetchWindGrid(b: BoundsRect): Promise<WindGrid> {
  const pts: { lat: number; lon: number }[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const rawLat = b.minLat + (r / (GRID_ROWS - 1)) * (b.maxLat - b.minLat);
      pts.push({
        lat: Math.max(-89.9, Math.min(89.9, rawLat)),
        lon: b.minLon + (c / (GRID_COLS - 1)) * (b.maxLon - b.minLon),
      });
    }
  }

  const latStr = pts.map((p) => p.lat.toFixed(2)).join(",");
  const lonStr = pts.map((p) => p.lon.toFixed(2)).join(",");
  // No explicit model → Open-Meteo picks the best available for each location.
  // ecmwf_ifs025 had an infrequent update cycle on the free tier and silently
  // returned zeros when unavailable, which froze all particles.
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latStr}&longitude=${lonStr}` +
    `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: unknown = await res.json();
    const items = Array.isArray(data) ? data : [data];

    const points: WindPoint[] = pts.map((pt, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = items[i] as any;
      const spd: number = item?.current?.wind_speed_10m ?? 0;
      const deg: number = item?.current?.wind_direction_10m ?? 0;
      const rad = (deg * Math.PI) / 180;
      // Meteorological FROM-direction → negate to get TO-direction vector
      return { lat: pt.lat, lon: pt.lon, u: -Math.sin(rad) * spd, v: -Math.cos(rad) * spd };
    });

    return { points, rows: GRID_ROWS, cols: GRID_COLS, bounds: b };
  } catch {
    return {
      points: pts.map((pt) => ({ ...pt, u: 0, v: 0 })),
      rows: GRID_ROWS,
      cols: GRID_COLS,
      bounds: b,
    };
  }
}

// ─── Interpolation ────────────────────────────────────────────────────────────

/** Bilinear interpolation: returns the u/v wind vector at any (lat, lon). */
export function sampleGrid(
  g: WindGrid,
  lat: number,
  lon: number,
): { u: number; v: number } {
  const {
    points,
    rows,
    cols,
    bounds: { minLat, maxLat, minLon, maxLon },
  } = g;

  const fy = Math.max(0, Math.min(1, (lat - minLat) / (maxLat - minLat)));
  const fx = Math.max(0, Math.min(1, (lon - minLon) / (maxLon - minLon)));

  const rowF = fy * (rows - 1);
  const colF = fx * (cols - 1);

  const r0 = Math.min(rows - 2, Math.floor(rowF));
  const c0 = Math.min(cols - 2, Math.floor(colF));
  const dr = rowF - r0;
  const dc = colF - c0;

  const get = (r: number, c: number): WindPoint =>
    points[r * cols + c] ?? { lat: 0, lon: 0, u: 0, v: 0 };

  const p00 = get(r0, c0);
  const p01 = get(r0, c0 + 1);
  const p10 = get(r0 + 1, c0);
  const p11 = get(r0 + 1, c0 + 1);

  return {
    u:
      p00.u * (1 - dc) * (1 - dr) +
      p01.u * dc * (1 - dr) +
      p10.u * (1 - dc) * dr +
      p11.u * dc * dr,
    v:
      p00.v * (1 - dc) * (1 - dr) +
      p01.v * dc * (1 - dr) +
      p10.v * (1 - dc) * dr +
      p11.v * dc * dr,
  };
}

// ─── Unit conversion ──────────────────────────────────────────────────────────

/**
 * Convert a u/v vector (both in m/s) to display-ready wind speed + FROM-direction.
 *
 *   wind_speed : m/s (metric) or mph (imperial) — ready for formatWindSpeed
 *   wind_deg   : meteorological FROM-direction 0–360 — same convention as OWM
 */
export function uvToWind(
  u: number,
  v: number,
  units: "metric" | "imperial",
): { wind_speed: number; wind_deg: number } {
  const speed_ms = Math.hypot(u, v);
  const wind_speed = units === "imperial" ? speed_ms * 2.237 : speed_ms;
  const wind_deg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return { wind_speed, wind_deg };
}
