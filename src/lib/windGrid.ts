/**
 * Shared wind-grid utilities used by both WindParticlesLayer (particle sim)
 * and useWindAtPoint (overlay / tooltip display).
 *
 * Keeping the fetch + interpolation logic here — rather than inside the
 * component — means both consumers can share the same React Query cache entry
 * so the overlay always shows exactly what the particles are flowing to.
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

export const GRID_ROWS = 3;
export const GRID_COLS = 3;

/**
 * Half-extents around the center point.
 * The grid spans center ± LAT_STEP lat and center ± LON_STEP lon so that
 * row 1 / col 1 (the center cell) lands exactly on the supplied lat/lon.
 * This guarantees sampleGrid(grid, lat, lon) == the raw Open-Meteo value at
 * that point — no bilinear error at the selected location.
 */
const LAT_STEP = 10; // degrees
const LON_STEP = 15; // degrees

// ─── Bounds helpers ───────────────────────────────────────────────────────────

/**
 * Compute a 3×3 grid bounding box centered exactly on (lat, lon).
 * No snapping — the caller's coords are already rounded to 2 dp by
 * useWeatherApp, giving natural cache stability without shifting the center.
 */
export function coordsBoundsFor(lat: number, lon: number): BoundsRect {
  return {
    minLat: lat - LAT_STEP,
    maxLat: lat + LAT_STEP,
    minLon: lon - LON_STEP,
    maxLon: lon + LON_STEP,
  };
}

/**
 * Expand map-viewport bounds and snap to the nearest `snap` degrees so that
 * small pans don't retrigger a fetch.  Used only for the free-pan particle
 * grid (not for the overlay, which always uses coordsBoundsFor).
 */
export function stableBounds(b: BoundsRect, snap = 5): BoundsRect {
  return {
    minLat: Math.floor((b.minLat - snap) / snap) * snap,
    maxLat: Math.ceil((b.maxLat + snap) / snap) * snap,
    minLon: Math.floor((b.minLon - snap) / snap) * snap,
    maxLon: Math.ceil((b.maxLon + snap) / snap) * snap,
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch wind data from Open-Meteo for each point in a GRID_ROWS × GRID_COLS
 * grid covering `b`.  Always fetches in m/s (internal SI); callers convert
 * to display units via uvToWind().
 */
export async function fetchWindGrid(b: BoundsRect): Promise<WindGrid> {
  const pts: { lat: number; lon: number }[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      pts.push({
        lat: b.minLat + (r / (GRID_ROWS - 1)) * (b.maxLat - b.minLat),
        lon: b.minLon + (c / (GRID_COLS - 1)) * (b.maxLon - b.minLon),
      });
    }
  }

  const points = await Promise.all(
    pts.map(async ({ lat, lon }): Promise<WindPoint> => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
          `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
        const res = await fetch(url);
        if (!res.ok) return { lat, lon, u: 0, v: 0 };
        const d = await res.json();
        const spd: number = d.current?.wind_speed_10m ?? 0;
        const deg: number = d.current?.wind_direction_10m ?? 0;
        const rad = (deg * Math.PI) / 180;
        // Meteorological FROM-direction → negate to get TO-direction vector
        return { lat, lon, u: -Math.sin(rad) * spd, v: -Math.cos(rad) * spd };
      } catch {
        return { lat, lon, u: 0, v: 0 };
      }
    }),
  );

  return { points, rows: GRID_ROWS, cols: GRID_COLS, bounds: b };
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
 *   wind_speed : in m/s (metric) or mph (imperial) — ready for formatWindSpeed
 *   wind_deg   : meteorological FROM-direction 0–360 — same convention as OWM
 */
export function uvToWind(
  u: number,
  v: number,
  units: "metric" | "imperial",
): { wind_speed: number; wind_deg: number } {
  const speed_ms = Math.hypot(u, v);
  const wind_speed = units === "imperial" ? speed_ms * 2.237 : speed_ms;
  // u = -sin(rad)*spd, v = -cos(rad)*spd  →  FROM-direction = atan2(-u, -v)
  const wind_deg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return { wind_speed, wind_deg };
}
