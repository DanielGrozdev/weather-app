import {
  MapContainer,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { MaptilerLayer, MapStyle } from "@maptiler/leaflet-maptilersdk";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coords } from "../types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { WindParticlesLayer } from "./WindParticles";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getWeather, reverseGeocode } from "../api";
import { useWindAtPoint } from "../hooks/useWindAtPoint";
import { useUnits } from "../hooks/useUnits";
import { formatTemp, formatWindSpeed } from "../lib/format";
import type { CityResult } from "../types";
import type { Units } from "../context/units-context";
import { useTranslation } from "react-i18next";
import {
  WebGLWeatherLayer,
  type WeatherLayer,
  type WeatherTileCoords,
} from "./WebGLWeatherLayer";

const API_KEY = import.meta.env.VITE_API_KEY;

// MapTiler basemap — dark style that matches the app's atmospheric, Windy-like
// inspiration. The MaptilerLayer accepts a `MapStyleVariant` object from the
// SDK's `MapStyle` enum; raw strings like "streets-v2-dark" are not recognized
// and the SDK falls back to the deprecated "Streets Default v2".
const MAPTILER_STYLE = MapStyle.STREETS.NIGHT;
const MAPTILER_API_KEY = "QRLg65UXd2y9kR0eA8d8";

type Props = {
  coords: Coords;
  onMapClick: (lat: number, lon: number) => void;
  mapType: string;
  windParticlesEnabled?: boolean;
  timeOffsetMinutes?: number;
  selectedCity: CityResult | null;
};

// ─── layer marker config ──────────────────────────────────────────────────────

type MarkerColors = { bg: string; glow: string };

/** Minimal shape that both current + hourly data satisfy. */
type DisplayData = {
  temp: number;
  wind_speed: number;
  wind_deg: number;
  pressure: number;
  humidity: number;
  clouds: number;
  pop?: number; // hourly only
  rain?: { "1h": number }; // present only when raining
  snow?: { "1h": number }; // present only when snowing
};

type LayerConfig = {
  /** Text shown inside the pill */
  getValue: (d: DisplayData, units: Units) => string;
  /** Background + glow colours for the pill */
  getColors: (d: DisplayData, units: Units) => MarkerColors;
  /** SVG <path> / <polygon> elements (24×24 Lucide viewBox) */
  iconPaths: string;
};

// ─── DOM marker builder (Step 4) ─────────────────────────────────────────────
// Builds the pill + triangle DOM tree without innerHTML string concatenation.
// L.divIcon accepts an HTMLElement directly for its `html` option, so we never
// need to serialize this back to a string.

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSvgIcon(paths: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "rgba(255,255,255,0.82)");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.style.cssText = "display:block;flex-shrink:0;";
  // paths is a trusted module-level constant, not user input
  svg.innerHTML = paths;
  return svg;
}

function createMarkerNode(
  colors: MarkerColors,
  iconPaths: string,
  value: string,
  locationLabel: string,
): HTMLElement {
  // Outer wrapper — carries the drop-shadow filter
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    `display:flex;flex-direction:column;align-items:center;width:120px;` +
    `filter:drop-shadow(0 4px 14px ${colors.glow});`;

  // Pill
  const pill = document.createElement("div");
  pill.style.cssText =
    `width:100px;flex-direction:column;display:flex;align-items:center;` +
    `justify-content:center;gap:5px;background:${colors.bg};color:#E8E8E8;` +
    `font-weight:700;font-size:13px;font-family:ui-sans-serif,system-ui,sans-serif;` +
    `line-height:1.2;padding:5px 0;border-radius:10px;` +
    `border:1.5px solid rgba(255,255,255,0.22);box-shadow:0 2px 6px rgba(0,0,0,0.28);`;

  if (locationLabel) {
    const name = document.createElement("span");
    name.style.cssText =
      `color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;` +
      `max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
    name.textContent = locationLabel;
    pill.appendChild(name);
  }

  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;justify-content:center;gap:5px;";
  row.appendChild(makeSvgIcon(iconPaths));

  const valueSpan = document.createElement("span");
  valueSpan.textContent = value;
  row.appendChild(valueSpan);

  pill.appendChild(row);
  wrapper.appendChild(pill);

  // Triangle tip
  const tip = document.createElementNS(SVG_NS, "svg");
  tip.setAttribute("width", "16");
  tip.setAttribute("height", "11");
  tip.setAttribute("viewBox", "0 0 16 11");
  tip.setAttribute("fill", "none");
  tip.style.cssText = "display:block;margin-top:-1px;";
  const poly = document.createElementNS(SVG_NS, "polygon");
  poly.setAttribute("points", "8,11 0,0 16,0");
  poly.setAttribute("fill", colors.bg);
  tip.appendChild(poly);
  wrapper.appendChild(tip);

  return wrapper;
}

const LAYER_CONFIG: Record<string, LayerConfig> = {
  temp_new: {
    getValue: (d, units) => formatTemp(d.temp, units),
    getColors: (d, units) => {
      const c = units === "imperial" ? (d.temp - 32) * (5 / 9) : d.temp;
      if (c <= -15) return { bg: "#6d28d9", glow: "rgba(109,40,217,0.55)" };
      if (c <= -5) return { bg: "#2563eb", glow: "rgba(37,99,235,0.55)" };
      if (c <= 5) return { bg: "#0ea5e9", glow: "rgba(14,165,233,0.55)" };
      if (c <= 12) return { bg: "#10b981", glow: "rgba(16,185,129,0.55)" };
      if (c <= 20) return { bg: "#f59e0b", glow: "rgba(245,158,11,0.55)" };
      if (c <= 28) return { bg: "#f97316", glow: "rgba(249,115,22,0.55)" };
      return { bg: "#ef4444", glow: "rgba(239,68,68,0.55)" };
    },
    iconPaths:
      '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  },
  pressure_new: {
    // OWM returns hPa; multiply by 100 → Pa (range 90000–104000 Pa)
    getValue: (d) => `${Math.round(d.pressure * 100)} Pa`,
    getColors: () => ({ bg: "#0369a1", glow: "rgba(3,105,161,0.55)" }),
    iconPaths: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  },
  wind_new: {
    getValue: (d, units) => formatWindSpeed(d.wind_speed, units),
    getColors: (d) => {
      const s = d.wind_speed; // m/s (metric) or mph
      if (s <= 3) return { bg: "#5b21b6", glow: "rgba(91,33,182,0.55)" };
      if (s <= 8) return { bg: "#4c1d95", glow: "rgba(76,29,149,0.55)" };
      if (s <= 15) return { bg: "#3b0764", glow: "rgba(59,7,100,0.55)" };
      return { bg: "#1e1b4b", glow: "rgba(30,27,75,0.55)" };
    },
    iconPaths:
      '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>' +
      '<path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>' +
      '<path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  },
  precipitation_new: {
    // Show actual rain/snow volume in mm/h; 0.0 when no precipitation expected
    getValue: (d) => {
      const mm = (d.rain?.["1h"] ?? 0) + (d.snow?.["1h"] ?? 0);
      return `${mm.toFixed(1)} mm/h`;
    },
    getColors: () => ({ bg: "#1d4ed8", glow: "rgba(29,78,216,0.55)" }),
    iconPaths:
      '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>' +
      '<path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  },
  clouds_new: {
    getValue: (d) => `${Math.round(d.clouds)} %`,
    getColors: () => ({ bg: "#374151", glow: "rgba(55,65,81,0.55)" }),
    iconPaths:
      '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  },
};

const FALLBACK_CONFIG: LayerConfig = LAYER_CONFIG["temp_new"];

// ─── tile URL ────────────────────────────────────────────────────────────────

function buildTileUrl(mapType: string, apiKey: string, offsetMinutes: number) {
  const base = `https://tile.openweathermap.org/map/${mapType}/{z}/{x}/{y}.png?appid=${apiKey}`;
  if (offsetMinutes === 0) return base;
  const ts = Math.floor((Date.now() + offsetMinutes * 60_000) / 1000);
  return `${base}&date=${ts}`;
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export default function Map({
  coords,
  onMapClick,
  mapType,
  windParticlesEnabled,
  timeOffsetMinutes = 0,
  selectedCity,
}: Props) {
  const { lat, lon } = coords;
  const tileUrl = useMemo(
    () => buildTileUrl(mapType, API_KEY, timeOffsetMinutes),
    [mapType, timeOffsetMinutes],
  );

  return (
    <MapContainer
      center={[lat, lon]}
      inertia
      touchZoom
      preferCanvas
      markerZoomAnimation
      zoomControl={false}
      zoom={6}
      minZoom={2}
      maxZoom={12}
      zoomSnap={0.5}
      zoomDelta={1}
      inertiaDeceleration={3000}
      easeLinearity={0.1}
      style={{ width: "100%", height: "100vh" }}
    >
      <MapController onMapClick={onMapClick} coords={coords} />
      <WindParticlesLayer enabled={windParticlesEnabled} coords={coords} />
      <MapTileLayer />
      <WeatherWebGLLayer url={tileUrl} />
      <CustomMarker
        coords={coords}
        mapType={mapType}
        timeOffsetMinutes={timeOffsetMinutes}
        selectedCity={selectedCity}
      />
    </MapContainer>
  );
}

// ─── Custom marker ────────────────────────────────────────────────────────────

/**
 * Flag-style pin: a temperature-pill (colour-coded by temperature) with a
 * downward-pointing triangle as the pin tip. On hover a compact tooltip shows
 * temperature, wind speed, and pressure.
 *
 * Uses the same React Query key as WeatherOverlay so there is no extra network
 * request — the response is always served from the in-memory cache.
 */
/** Mirrors the same hourly-selection logic used in WeatherOverlay. */
function pickDisplayData(
  data: Awaited<ReturnType<typeof getWeather>>,
  offsetMinutes: number,
) {
  if (offsetMinutes <= 0) return data.current;
  const targetTs = Date.now() / 1000 + offsetMinutes * 60;
  const future = data.hourly.filter(
    (h) => h.dt >= Math.floor(Date.now() / 1000) - 1800,
  );
  if (future.length === 0) return data.current;
  return future.reduce((best, h) =>
    Math.abs(h.dt - targetTs) < Math.abs(best.dt - targetTs) ? h : best,
  );
}

function CustomMarker({
  coords,
  mapType,
  timeOffsetMinutes = 0,
  selectedCity,
}: {
  coords: Coords;
  mapType: string;
  timeOffsetMinutes?: number;
  selectedCity: CityResult | null;
}) {
  const { units } = useUnits();
  const { t } = useTranslation();

  // ── Step 2: stable query keys via rounded coords (set upstream in useWeatherApp)
  // placeholderData keeps the previous result visible while a new fetch runs,
  // preventing the marker from flickering to "–" during refetches.
  const { data: pinnedCity } = useQuery({
    queryKey: ["reverseGeocode", coords.lat, coords.lon],
    queryFn: () => reverseGeocode(coords.lat, coords.lon),
    enabled: selectedCity === null,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

  const { data } = useQuery({
    queryKey: ["weather", coords.lat, coords.lon, units],
    queryFn: () => getWeather({ lat: coords.lat, lon: coords.lon, units }),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Same wind grid as WindParticlesLayer and WeatherOverlay — shared cache entry.
  const omWind = useWindAtPoint(coords, units);

  // ── Step 1: memoize all derived values so the icon is only rebuilt when
  // something actually changed, not on every parent render.

  const display = useMemo(() => {
    if (!data) return null;
    return mapType === "precipitation_new" &&
      timeOffsetMinutes <= 0 &&
      data.hourly.length > 0
      ? data.hourly[0]
      : pickDisplayData(data, timeOffsetMinutes);
  }, [data, mapType, timeOffsetMinutes]);

  // cfg is stable per mapType — avoids getValue/getColors closure churn
  const cfg = useMemo(
    () => LAYER_CONFIG[mapType] ?? FALLBACK_CONFIG,
    [mapType],
  );

  const value = useMemo(
    () => (display ? cfg.getValue(display, units) : "–"),
    [display, cfg, units],
  );

  const colors = useMemo(
    () =>
      display
        ? cfg.getColors(display, units)
        : { bg: "#6b7280", glow: "rgba(107,114,128,0.4)" },
    [display, cfg, units],
  );

  const locationLabel = useMemo(() => {
    if (selectedCity) return `${selectedCity.name}, ${selectedCity.country}`;
    if (pinnedCity) return `${pinnedCity.name}, ${pinnedCity.country}`;
    return "";
  }, [selectedCity, pinnedCity]);

  // ── Step 4: build the icon from real DOM nodes instead of an HTML string.
  // L.divIcon accepts HTMLElement directly; no innerHTML concatenation in the
  // render path. The useMemo ensures we only create a new DOM tree + DivIcon
  // instance when one of the stable memoized values above actually changed.
  const icon = useMemo(
    () =>
      L.divIcon({
        html: createMarkerNode(colors, cfg.iconPaths, value, locationLabel),
        className: "weather-marker-icon",
        iconSize: [120, 58],
        iconAnchor: [60, 58],
      }),
    [colors, cfg, value, locationLabel],
  );

  return (
    <Marker position={[coords.lat, coords.lon]} icon={icon}>
      {display && (
        <Tooltip
          direction="right"
          offset={[10, -18]}
          opacity={1}
          className="weather-marker-tooltip"
        >
          <div className="wmt-inner">
            <div className="wmt-row">
              <span>{t("tooltip.temperature")}</span>
              <span>{formatTemp(display.temp, units)}</span>
            </div>
            <div className="wmt-row">
              <span>{t("tooltip.windSpeed")}</span>
              <span className="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: `rotate(${((omWind?.wind_deg ?? display.wind_deg) + 180) % 360}deg)`,
                    display: "inline-block",
                    flexShrink: 0,
                    opacity: 0.75,
                  }}
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
                {formatWindSpeed(
                  omWind?.wind_speed ?? display.wind_speed,
                  units,
                )}
              </span>
            </div>
            <div className="wmt-row">
              <span>{t("tooltip.pressure")}</span>
              <span>{Math.round(display.pressure)} hPa</span>
            </div>
          </div>
        </Tooltip>
      )}
    </Marker>
  );
}

// ─── MapController ────────────────────────────────────────────────────────────

/**
 * Pans the map when coords change and registers a single click handler that
 * forwards lat/lng up. Replaces the previous render-side `map.on('click', ...)`
 * call which leaked a new listener on every render.
 *
 * `panTo` must wait for the map's panes to be ready, otherwise it crashes with
 * "Cannot read properties of undefined (reading '_leaflet_pos')" — particularly
 * under React StrictMode where the map double-mounts in dev. `whenReady`
 * resolves immediately if the map is already initialized, so it's safe to use
 * for both the first-paint pan and subsequent coord changes.
 */
const MapController = ({
  onMapClick,
  coords,
}: {
  onMapClick: (lat: number, lon: number) => void;
  coords: Coords;
}) => {
  const map = useMap();
  const handleClick = useCallback(
    (e: { latlng: { lat: number; lng: number } }) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    [onMapClick],
  );

  useEffect(() => {
    let cancelled = false;
    map.whenReady(() => {
      if (cancelled) return;
      try {
        // Jump directly to the new location so Leaflet doesn't fetch every
        // intermediate tile across long distances (e.g. EU → US).
        map.setView([coords.lat, coords.lon], map.getZoom(), {
          animate: false,
        });
      } catch {
        // The map was torn down between whenReady and now (StrictMode
        // double-effect). Safe to ignore — the next mount will pan correctly.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coords.lat, coords.lon, map]);

  useMapEvents({
    click: (e) => handleClick(e),
  });

  return null;
};

// ─── MapTileLayer ─────────────────────────────────────────────────────────────

function MapTileLayer() {
  const map = useMap();

  useEffect(() => {
    const tileLayer = new MaptilerLayer({
      style: MAPTILER_STYLE,
      apiKey: MAPTILER_API_KEY,
    });
    tileLayer.addTo(map);

    return () => {
      try {
        map.removeLayer(tileLayer);
      } catch {
        // Map already torn down (StrictMode double-effect / unmount race).
      }
    };
  }, [map]);

  return null;
}

function WeatherWebGLLayer({ url }: { url: string }) {
  const map = useMap();
  const layerRef = useRef<L.GridLayer | null>(null);

  useEffect(() => {
    // remove old layer immediately
    layerRef.current?.remove();

    const layer = new (WebGLWeatherLayer as new (
      ...args: object[]
    ) => WeatherLayer)({
      tileSize: 256,
      opacity: 0.7,
      keepBuffer: 2,
      updateWhenZooming: true,
      getTileUrl: (coords: WeatherTileCoords) =>
        url
          .replace("{z}", String(coords.z))
          .replace("{x}", String(coords.x))
          .replace("{y}", String(coords.y)),
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layer.remove();
    };
  }, [map, url]);

  return null;
}
