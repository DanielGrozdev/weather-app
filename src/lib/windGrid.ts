/**
 * Wind-grid utilities — WindParticlesLayer + useWindAtPoint.
 *
 * Data source: Open-Meteo (ECMWF IFS 0.25° model — same as Windy.com).
 * Grid: global 10×20 = 200 points, single batched GET, covers -75°→75° lat
 *       / -180°→180° lon at ~17°×19° spacing. Sufficient to show major
 *       synoptic patterns (trade winds, westerlies, jet stream) at any zoom.
 *
 * Caching:
 *   sessionStorage — 30-min TTL, survives Vite HMR reloads so development
 *                    never burns the rate limit.
 *   React Query    — staleTime:Infinity on top of sessionStorage.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** u = eastward m/s, v = northward m/s */
export type WindPoint = { lat: number; lon: number; u: number; v: number };

export type WindGrid = {
  points: WindPoint[];
  rows: number;
  cols: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

// ─── Grid constants ───────────────────────────────────────────────────────────

export const GRID_ROWS = 10;
export const GRID_COLS = 20;

const MIN_LAT = -75;
const MAX_LAT = 75;
const MIN_LON = -180;
const MAX_LON = 180;

// ─── Session-storage cache ────────────────────────────────────────────────────

const SS_KEY = "windGrid_global";
const SS_TTL_MS = 30 * 60 * 1000;

function ssRead(): WindGrid | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: WindGrid };
    return Date.now() - ts < SS_TTL_MS ? data : null;
  } catch {
    return null;
  }
}

function ssWrite(grid: WindGrid): void {
  try {
    sessionStorage.setItem(
      SS_KEY,
      JSON.stringify({ ts: Date.now(), data: grid }),
    );
  } catch {
    /* quota exceeded — skip */
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchWindGrid(): Promise<WindGrid> {
  const cached = ssRead();
  if (cached) return cached;

  const pts: { lat: number; lon: number }[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      pts.push({
        lat: MIN_LAT + (r / (GRID_ROWS - 1)) * (MAX_LAT - MIN_LAT),
        lon: MIN_LON + (c / (GRID_COLS - 1)) * (MAX_LON - MIN_LON),
      });
    }
  }

  const latStr = pts.map((p) => p.lat.toFixed(2)).join(",");
  const lonStr = pts.map((p) => p.lon.toFixed(2)).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latStr}&longitude=${lonStr}` +
    `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const data: unknown = await res.json();
  const items = Array.isArray(data) ? data : [data];

  const points: WindPoint[] = pts.map((pt, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = items[i] as any;
    const spd: number = item?.current?.wind_speed_10m ?? 0;
    const deg: number = item?.current?.wind_direction_10m ?? 0;
    const rad = (deg * Math.PI) / 180;
    // Meteorological FROM-direction → negate → TO-direction u/v
    return {
      lat: pt.lat,
      lon: pt.lon,
      u: -spd * Math.sin(rad),
      v: -spd * Math.cos(rad),
    };
  });

  const grid: WindGrid = {
    points,
    rows: GRID_ROWS,
    cols: GRID_COLS,
    minLat: MIN_LAT,
    maxLat: MAX_LAT,
    minLon: MIN_LON,
    maxLon: MAX_LON,
  };
  ssWrite(grid);
  return grid;
}

// ─── Bilinear interpolation ───────────────────────────────────────────────────

export function sampleGrid(
  g: WindGrid,
  lat: number,
  lon: number,
): { u: number; v: number } {
  const { points, rows, cols, minLat, maxLat, minLon, maxLon } = g;

  // 1. Normalize Longitude to always be within [-180, 180] for calculation
  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180;

  // 2. Vertical fraction (Latitude) - Clamp because poles don't wrap
  const fy = Math.max(0, Math.min(1, (lat - minLat) / (maxLat - minLat)));

  // 3. Horizontal fraction (Longitude)
  const fx = (wrappedLon - minLon) / (maxLon - minLon);

  const rowF = fy * (rows - 1);
  const colF = fx * (cols - 1);

  const r0 = Math.min(rows - 2, Math.floor(rowF));
  const r1 = r0 + 1;

  // 4. WRAP Column Indices
  // We use modulo (%) so that if c0 is the last index, c1 wraps to 0
  const c0 = Math.floor(colF + cols) % cols;
  const c1 = (c0 + 1) % cols;

  const dr = rowF - Math.floor(rowF);
  const dc = colF - Math.floor(colF);

  const get = (r: number, c: number): WindPoint =>
    points[r * cols + c] ?? { lat: 0, lon: 0, u: 0, v: 0 };

  const p00 = get(r0, c0);
  const p01 = get(r0, c1);
  const p10 = get(r1, c0);
  const p11 = get(r1, c1);

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
