import { useEffect, useMemo, useState } from "react";
import { Marker, useMap } from "react-map-gl/maplibre";
import { useQuery } from "@tanstack/react-query";
import { fetchWindGrid, sampleGrid, uvToWind } from "../lib/windGrid";
import type { LngLatBounds } from "maplibre-gl";

// ─── colour scale — matches LAYER_CONFIG wind_new.getColors ──────────────────

function windColor(ms: number): string {
  if (ms < 2) return "#b478c8";
  if (ms < 7) return "#7850a0";
  if (ms < 14) return "#462878";
  if (ms < 21) return "#1e1450";
  return "#0a0a28";
}

// ─── deterministic jitter (stable on pan, no randomness per-render) ──────────

function jitter(seed1: number, seed2: number): number {
  const x = Math.sin(seed1 * 127.1 + seed2 * 311.7) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2; // [-1, 1]
}

// ─── component ────────────────────────────────────────────────────────────────

// Desired marker spacing in screen pixels
const PX_SPACING = 80;
// Jitter amplitude as a fraction of step — 0.45 gives ~90% of step max offset
const JITTER = 0.45;

type WindMarker = {
  lat: number;
  lon: number;
  wind_speed: number;
  wind_deg: number;
};

export function WindPoiLayer() {
  const { current: map } = useMap();
  const [viewport, setViewport] = useState<{
    bounds: LngLatBounds;
    zoom: number;
  } | null>(null);

  const { data: grid } = useQuery({
    queryKey: ["windGrid", "global"],
    queryFn: fetchWindGrid,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!map) return;
    const sync = () =>
      setViewport({ bounds: map.getBounds(), zoom: map.getZoom() });
    sync();
    map.on("moveend", sync);
    return () => {
      map.off("moveend", sync);
    };
  }, [map]);

  const markers = useMemo((): WindMarker[] => {
    if (!grid || !viewport) return [];

    const { bounds, zoom } = viewport;
    const s = bounds.getSouth();
    const n = bounds.getNorth();
    const w = bounds.getWest();
    const e = bounds.getEast();

    // Convert desired pixel gap to degrees at this zoom level
    const degPerPx = 360 / (256 * Math.pow(2, zoom));
    const step = Math.max(0.25, PX_SPACING * degPerPx);

    // Snap grid origin to multiples of step so markers are stable on pan
    const latStart = Math.ceil(s / step) * step;
    const lonStart = Math.ceil(w / step) * step;

    const result: WindMarker[] = [];
    for (let lat = latStart; lat <= n; lat += step) {
      for (let lon = lonStart; lon <= e; lon += step) {
        if (lat < grid.minLat || lat > grid.maxLat) continue;

        // Jitter each point by a position-deterministic offset so the layout
        // looks organic but doesn't shift when you pan.
        const finalLat = lat + jitter(lat, lon) * step * JITTER;
        const finalLon = lon + jitter(lon, lat) * step * JITTER;

        const { u, v } = sampleGrid(grid, finalLat, finalLon);
        const { wind_speed, wind_deg } = uvToWind(u, v, "metric");

        result.push({ lat: finalLat, lon: finalLon, wind_speed, wind_deg });
      }
    }
    return result;
  }, [grid, viewport]);

  if (!markers.length) return null;

  return (
    <>
      {markers.map(({ lat, lon, wind_speed, wind_deg }, i) => {
        const color = windColor(wind_speed);
        // wind_deg is FROM-direction; +180 → TO-direction for the arrow
        const arrowDeg = (wind_deg + 180) % 360;
        const speed = Math.round(wind_speed);

        return (
          <Marker
            key={i}
            longitude={lon}
            latitude={lat}
            anchor="center"
          >
            <div
              style={{ backgroundColor: color }}
              className="inline-flex items-center gap-[3px] px-[5px] py-[3px]
                         rounded shadow-md select-none cursor-default
                         border border-white/10"
            >
              <svg
                width="7"
                height="7"
                viewBox="0 0 8 8"
                style={{ transform: `rotate(${arrowDeg}deg)`, flexShrink: 0 }}
              >
                <polygon points="4,0 8,8 0,8" fill="rgba(255,255,255,0.9)" />
              </svg>
              <span className="text-[10px] font-bold leading-none text-white tabular-nums">
                {speed}
              </span>
            </div>
          </Marker>
        );
      })}
    </>
  );
}
