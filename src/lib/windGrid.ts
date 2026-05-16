/**
 * Wind-grid utilities.
 *
 * fetchStaticWindData() — loads /public/data/wind.json written by fetch_wind_data.js
 *                         (GFS via NOMADS, or Open-Meteo fallback).
 * fetchWindGrid()       — live Open-Meteo fetch (10×20, 200 pts) with sessionStorage
 *                         cache; used for POI markers and as particle fallback.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** u = eastward m/s, v = northward m/s */
type WindPoint = { lat: number; lon: number; u: number; v: number };

export type WindGrid = {
  points: WindPoint[];
  rows: number;
  cols: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

// ─── Static wind.json (from fetch_wind_data.js) ──────────────────────────────

type WindJsonPoint = { lat: number; lon: number; u: number; v: number; time: string };

/**
 * Converts the flat [{lat,lon,u,v,time}] array produced by the script into a
 * WindGrid by inferring grid dimensions from the unique sorted lat/lon values.
 */
function windJsonToGrid(pts: WindJsonPoint[]): WindGrid {
  const lats = [...new Set(pts.map((p) => p.lat))].sort((a, b) => a - b); // S→N
  const lons = [...new Set(pts.map((p) => p.lon))].sort((a, b) => a - b); // W→E
  const rows = lats.length;
  const cols = lons.length;
  const latIdx = new Map(lats.map((lat, i) => [lat, i]));
  const lonIdx = new Map(lons.map((lon, i) => [lon, i]));

  const points: WindPoint[] = Array.from({ length: rows * cols }, (_, i) => ({
    lat: lats[Math.floor(i / cols)],
    lon: lons[i % cols],
    u: 0,
    v: 0,
  }));
  for (const p of pts) {
    const r = latIdx.get(p.lat);
    const c = lonIdx.get(p.lon);
    if (r !== undefined && c !== undefined)
      points[r * cols + c] = { lat: p.lat, lon: p.lon, u: p.u, v: p.v };
  }
  return { points, rows, cols, minLat: lats[0], maxLat: lats[rows - 1], minLon: lons[0], maxLon: lons[cols - 1] };
}

/**
 * Loads /data/wind.json written by `npm run fetch-wind`.
 * Throws when the file is absent or empty so callers can fall back gracefully.
 */
export async function fetchStaticWindData(): Promise<WindGrid> {
  const res = await fetch('/data/wind.json');
  if (!res.ok) throw new Error(`wind.json not found (HTTP ${res.status})`);
  const pts: WindJsonPoint[] = await res.json();
  if (!Array.isArray(pts) || pts.length === 0) throw new Error('wind.json is empty');
  return windJsonToGrid(pts);
}

// ─── Grid constants (live Open-Meteo fetch) ───────────────────────────────────

const ROWS = 10;
const COLS = 20;
const MIN_LAT = -80;
const MAX_LAT = 80;
const MIN_LON = -180;
const DX = 360 / COLS;                            // 18°
const DY = (MAX_LAT - MIN_LAT) / (ROWS - 1);      // ~17.78°
const CACHE_KEY = 'windGrid_v2';
const CACHE_TTL_MS = 30 * 60 * 1000;              // 30 min

function makePts() {
  const pts: { lat: number; lon: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      pts.push({ lat: MIN_LAT + r * DY, lon: MIN_LON + c * DX });
  return pts;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchWindGrid(): Promise<WindGrid> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const { grid, ts } = JSON.parse(raw) as { grid: WindGrid; ts: number };
      if (Date.now() - ts < CACHE_TTL_MS) return grid;
    }
  } catch { /* storage unavailable */ }

  try {
    const pts = makePts();
    const latStr = pts.map((p) => p.lat.toFixed(2)).join(',');
    const lonStr = pts.map((p) => p.lon.toFixed(2)).join(',');
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}` +
        `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = (await res.json()) as {
      current?: { wind_speed_10m?: number; wind_direction_10m?: number };
    }[];

    const points: WindPoint[] = pts.map((p, idx) => {
      const spd = items[idx]?.current?.wind_speed_10m ?? 0;
      const deg = items[idx]?.current?.wind_direction_10m ?? 0;
      const rad = (deg * Math.PI) / 180;
      return { lat: p.lat, lon: p.lon, u: -spd * Math.sin(rad), v: -spd * Math.cos(rad) };
    });

    const grid: WindGrid = {
      points,
      rows: ROWS,
      cols: COLS,
      minLat: MIN_LAT,
      maxLat: MIN_LAT + (ROWS - 1) * DY,
      minLon: MIN_LON,
      maxLon: MIN_LON + (COLS - 1) * DX,
    };

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ grid, ts: Date.now() }));
    } catch { /* storage full */ }

    return grid;
  } catch {
    console.warn('fetchWindGrid: Open-Meteo unavailable — using synthetic wind');
    return makeSyntheticWindGrid();
  }
}

// ─── Synthetic fallback ───────────────────────────────────────────────────────
// 5° global grid (37×72 = 2664 pts) — high enough resolution for smooth
// particle flow even when Open-Meteo is unavailable.

const SYN_ROWS = 37;
const SYN_COLS = 72;
const SYN_DY = 5;
const SYN_DX = 5;

function makeSyntheticWindGrid(): WindGrid {
  const points: WindPoint[] = [];
  for (let r = 0; r < SYN_ROWS; r++) {
    const lat = -90 + r * SYN_DY;
    const latR = (lat * Math.PI) / 180;
    const absLat = Math.abs(lat);
    for (let c = 0; c < SYN_COLS; c++) {
      const lon = -180 + c * SYN_DX;
      const lonR = (lon * Math.PI) / 180;
      let u: number;
      if (absLat > 65)      u = -2.5;
      else if (absLat > 35) u = 9 * Math.sin(((absLat - 35) * Math.PI) / 30);
      else                  u = -5 * Math.cos((absLat * Math.PI) / 70);
      u += 2.5 * Math.sin(2 * lonR) * Math.cos(latR);
      const v =
        1.8 * Math.sin(lonR) * Math.cos(2 * latR) +
        0.8 * Math.cos(1.5 * lonR) * Math.sin(latR * 2);
      points.push({ lat, lon, u, v });
    }
  }
  return {
    points,
    rows: SYN_ROWS,
    cols: SYN_COLS,
    minLat: -90,
    maxLat: 85,
    minLon: -180,
    maxLon: 175,
  };
}

// ─── Bilinear interpolation ───────────────────────────────────────────────────

export function sampleGrid(
  g: WindGrid,
  lat: number,
  lon: number,
): { u: number; v: number } {
  const { points, rows, cols, minLat, maxLat, minLon, maxLon } = g;

  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const fy = Math.max(0, Math.min(1, (lat - minLat) / (maxLat - minLat)));
  const fx = (wrappedLon - minLon) / (maxLon - minLon);

  const rowF = fy * (rows - 1);
  const colF = fx * (cols - 1);

  const r0 = Math.min(rows - 2, Math.floor(rowF));
  const r1 = r0 + 1;
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
    u: p00.u * (1 - dc) * (1 - dr) + p01.u * dc * (1 - dr) + p10.u * (1 - dc) * dr + p11.u * dc * dr,
    v: p00.v * (1 - dc) * (1 - dr) + p01.v * dc * (1 - dr) + p10.v * (1 - dc) * dr + p11.v * dc * dr,
  };
}

// ─── Unit conversion ──────────────────────────────────────────────────────────

export function uvToWind(
  u: number,
  v: number,
  units: 'metric' | 'imperial',
): { wind_speed: number; wind_deg: number } {
  const speed_ms = Math.hypot(u, v);
  const wind_speed = units === 'imperial' ? speed_ms * 2.237 : speed_ms;
  const wind_deg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return { wind_speed, wind_deg };
}

// ─── Shared fetcher ───────────────────────────────────────────────────────────
// Single source of truth used by particles, POI markers and point-lookup hook,
// so every consumer samples the same grid and shows the same speed/direction.

export const WIND_QUERY_KEY = ['windData'] as const;
export const fetchWindData = () =>
  fetchStaticWindData().catch(() => fetchWindGrid());
