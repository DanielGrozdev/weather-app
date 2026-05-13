import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  type MapMouseEvent,
  type MapRef,
  type MapSourceDataEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coords, CityResult, MapLayerType } from "../types";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getWeather, reverseGeocode } from "../api";
import { useUnits } from "../hooks/useUnits";
import { useWindAtPoint } from "../hooks/useWindAtPoint";
import { LAYER_CONFIG } from "../lib/consts";
import { WindParticlesLayer } from "./WindParticles";
import { WindPoiLayer } from "./WindPoiLayer";

const API_KEY = import.meta.env.VITE_API_KEY;
const MAPTILER_API_KEY = import.meta.env.VITE_MAP_TILER_KEY;
const MAPTILER_STYLE = `https://api.maptiler.com/maps/backdrop-dark/style.json?key=${MAPTILER_API_KEY}`;

const FADE_MS = 300;

type Props = {
  coords: Coords;
  customCoords: Coords | null;
  onMapClick: (lat: number, lon: number) => void;
  mapType: MapLayerType;
  windParticlesEnabled?: boolean;
  selectedCity: CityResult | null;
  onSyncingChange?: (syncing: boolean) => void;
  selectedTime?: number; // 0 or absent = live; Unix timestamp = forecast step
};

// time > 0 appends &date= so OWM serves the forecast raster for that timestamp.
function buildTileUrl(mapType: MapLayerType, apiKey: string, time = 0): string {
  const base = `https://tile.openweathermap.org/map/${mapType}/{z}/{x}/{y}.png?appid=${apiKey}`;
  return time > 0 ? `${base}&date=${time}` : base;
}

// Returns true when the destination is close enough that its tiles are likely
// already loaded or will load within a frame or two. We expand the current
// viewport by 1× in every direction (so a 2× box total) — anything inside
// that region doesn't need a cinematic fade.
function isNearby(map: maplibregl.Map, lat: number, lon: number): boolean {
  const b = map.getBounds();
  const latSpan = b.getNorth() - b.getSouth();
  const lngSpan = b.getEast() - b.getWest();
  return (
    lat >= b.getSouth() - latSpan &&
    lat <= b.getNorth() + latSpan &&
    lon >= b.getWest() - lngSpan &&
    lon <= b.getEast() + lngSpan
  );
}

type SlotState = { url: string; opacity: number };

const LAYER_PAINT = (opacity: number) =>
  ({
    "raster-opacity-transition": { duration: FADE_MS, delay: 0 },
    "raster-opacity": opacity,
    "raster-fade-duration": 300,
    "raster-resampling": "linear",
  }) as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeatherMap({
  coords,
  onMapClick,
  mapType,
  windParticlesEnabled,
  selectedCity,
  onSyncingChange,
  selectedTime = 0,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  // Pre-seed with initial coords so the flight effect skips on first mount
  const lastFlownCoords = useRef({ lat: coords.lat, lon: coords.lon });
  const mapTypeRef = useRef<MapLayerType>(mapType);

  // Derived tile URL — changes when either mapType or selectedTime changes.
  const tileUrl = buildTileUrl(mapType, API_KEY, selectedTime);

  // ── Double-buffer state ────────────────────────────────────────────────────
  const [slotA, setSlotA] = useState<SlotState>({
    url: buildTileUrl(mapType, API_KEY, 0), // initial: live tiles
    opacity: 0, // starts invisible; handleIdle fades it in on first load
  });
  const [slotB, setSlotB] = useState<SlotState>({ url: "", opacity: 0 });

  // Refs so event callbacks can read current values without stale closures
  const activeSlotRef = useRef<"A" | "B">("A");
  const pendingSlotRef = useRef<"A" | "B" | null>(null);
  const transitioningRef = useRef(false);
  const isSyncingRef = useRef(false);
  const genRef = useRef(0); // incremented on each mapType change to cancel stale timeouts
  const onSyncingRef = useRef(onSyncingChange);

  // ── Fade-on-Flight refs ────────────────────────────────────────────────────
  const flightGenRef = useRef(0); // incremented on each coords change
  const waitingForIdleRef = useRef(false); // true while flyTo is in progress
  const initialLoadRef = useRef(true); // cleared after the very first idle

  useEffect(() => {
    onSyncingRef.current = onSyncingChange;
  }, [onSyncingChange]);

  useEffect(() => {
    mapTypeRef.current = mapType;
  }, [mapType]);

  // ── Resize handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => mapRef.current?.resize(), 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  // ── Mount hidden pending slot when tileUrl changes (mapType or time) ────────
  const prevTileUrlRef = useRef(tileUrl);
  useEffect(() => {
    if (tileUrl === prevTileUrlRef.current) return;
    prevTileUrlRef.current = tileUrl;

    const active = activeSlotRef.current;
    const pending: "A" | "B" = active === "A" ? "B" : "A";

    pendingSlotRef.current = pending;
    transitioningRef.current = false;
    genRef.current++;

    isSyncingRef.current = true;
    onSyncingRef.current?.(true);

    if (pending === "A") setSlotA({ url: tileUrl, opacity: 0 });
    else setSlotB({ url: tileUrl, opacity: 0 });
  }, [tileUrl]);

  // ── Cross-fade when pending source reports loaded ──────────────────────────
  const handleSourceData = useCallback((e: MapSourceDataEvent) => {
    if (!e.isSourceLoaded || transitioningRef.current || !isSyncingRef.current)
      return;
    const pending = pendingSlotRef.current;
    if (!pending || e.sourceId !== `weather-source-${pending}`) return;

    transitioningRef.current = true;
    const active = activeSlotRef.current;
    const gen = genRef.current;

    // Brief pause so initial tiles have time to arrive before the old layer fades
    setTimeout(() => {
      if (genRef.current !== gen) return; // mapType changed again — abort

      if (pending === "A") {
        setSlotA((s) => ({ ...s, opacity: 1 }));
        setSlotB((s) => ({ ...s, opacity: 0 }));
      } else {
        setSlotB((s) => ({ ...s, opacity: 1 }));
        setSlotA((s) => ({ ...s, opacity: 0 }));
      }

      // After the CSS transition finishes, tear down the old slot
      setTimeout(() => {
        if (genRef.current !== gen) return;

        activeSlotRef.current = pending;
        pendingSlotRef.current = null;

        // Unmount old source to free GPU memory
        if (active === "A") setSlotA({ url: "", opacity: 0 });
        else setSlotB({ url: "", opacity: 0 });

        isSyncingRef.current = false;
        onSyncingRef.current?.(false);
        transitioningRef.current = false;
      }, FADE_MS + 50);
    }, 300);
  }, []);

  // ── Fade-on-Flight: fade → flyTo → idle → fade back ──────────────────────
  useEffect(() => {
    if (
      coords.lat === lastFlownCoords.current?.lat &&
      coords.lon === lastFlownCoords.current?.lon
    )
      return;

    lastFlownCoords.current = { lat: coords.lat, lon: coords.lon };

    flightGenRef.current++;
    const gen = flightGenRef.current;
    waitingForIdleRef.current = false;

    const map = mapRef.current?.getMap();
    const nearby = map ? isNearby(map, coords.lat, coords.lon) : true;

    const doFly = () => {
      if (flightGenRef.current !== gen) return;
      const currentZoom = mapRef.current?.getZoom() ?? 5;
      mapRef.current?.flyTo({
        center: [coords.lon, coords.lat],
        duration: 4000,
        zoom: Math.max(currentZoom, 5), // never zoom the user out
        essential: true,
      });
      if (!nearby) waitingForIdleRef.current = true;
    };

    if (nearby) {
      // Destination tiles are already in view or cache — fly straight away, no fade.
      doFly();
    } else {
      // Destination is far: dim the layer so blank tiles during travel are invisible.
      const active = activeSlotRef.current;
      if (active === "A") setSlotA((s) => ({ ...s, opacity: 0 }));
      else setSlotB((s) => ({ ...s, opacity: 0 }));
      doFly();
    }
  }, [coords]);

  // Step 3: idle fires when camera has stopped AND all viewport tiles are loaded
  const handleIdle = useCallback(() => {
    const active = activeSlotRef.current;
    const fadeIn = () => {
      if (active === "A") setSlotA((s) => ({ ...s, opacity: 1 }));
      else setSlotB((s) => ({ ...s, opacity: 1 }));
    };

    // Always fade in on the very first idle (initial page load).
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      waitingForIdleRef.current = false;
      fadeIn();
      return;
    }

    if (!waitingForIdleRef.current) return;
    waitingForIdleRef.current = false;
    fadeIn();
  }, []);

  return (
    <Map
      ref={mapRef}
      reuseMaps
      renderWorldCopies
      mapStyle={MAPTILER_STYLE}
      attributionControl={false}
      initialViewState={{
        latitude: coords.lat,
        longitude: coords.lon,
        zoom: 5,
      }}
      minZoom={1}
      maxZoom={10}
      localIdeographFontFamily="sans-serif"
      collectResourceTiming={false}
      trackResize={false}
      style={{ width: "100%", height: "100vh" }}
      onClick={(e: MapMouseEvent) => onMapClick(e.lngLat.lat, e.lngLat.lng)}
      maxTileCacheSize={500}
      fadeDuration={500}
      refreshExpiredTiles={false}
      onSourceData={handleSourceData}
      onIdle={handleIdle}
    >
      {/* Buffer A */}
      {slotA.url && (
        <Source
          id="weather-source-A"
          type="raster"
          tiles={[slotA.url]}
          tileSize={256}
          minzoom={0}
          maxzoom={12}
          volatile
        >
          <Layer
            id="weather-layer-A"
            type="raster"
            paint={LAYER_PAINT(slotA.opacity)}
          />
        </Source>
      )}

      {/* Buffer B */}
      {slotB.url && (
        <Source
          id="weather-source-B"
          type="raster"
          tiles={[slotB.url]}
          tileSize={256}
          minzoom={0}
          maxzoom={12}
        >
          <Layer
            id="weather-layer-B"
            type="raster"
            paint={LAYER_PAINT(slotB.opacity)}
          />
        </Source>
      )}

      <CustomMarker
        coords={coords}
        mapType={mapType}
        selectedCity={selectedCity}
        selectedTime={selectedTime}
      />

      {mapType === "wind_new" && <WindPoiLayer />}

      <WindParticlesLayer enabled={windParticlesEnabled} coords={coords} />
    </Map>
  );
}

// ─── Marker ───────────────────────────────────────────────────────────────────

function CustomMarker({
  coords,
  mapType,
  selectedCity,
  selectedTime,
}: {
  coords: Coords;
  mapType: MapLayerType;
  selectedCity: CityResult | null;
  selectedTime: number;
}) {
  const { units } = useUnits();
  const omWind = useWindAtPoint(coords, units);

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
    placeholderData: keepPreviousData,
  });

  const cfg = LAYER_CONFIG[mapType];

  // When a forecast time is selected, find the closest hourly entry so the
  // marker value and colour match what the tile layer is showing.
  const display = useMemo(() => {
    if (!data) return null;
    if (!selectedTime || !data.hourly.length) return data.current;
    return data.hourly.reduce((best, h) =>
      Math.abs(h.dt - selectedTime) < Math.abs(best.dt - selectedTime)
        ? h
        : best,
    );
  }, [data, selectedTime]);

  const value = display ? cfg.getValue(display, units) : "–";
  const colors = display
    ? cfg.getColors(display, units)
    : { bg: "#6b7280", glow: "rgba(0,0,0,0.3)" };

  const locationLabel = useMemo(() => {
    if (selectedCity) return `${selectedCity.name}, ${selectedCity.country}`;
    if (pinnedCity) return `${pinnedCity.name}, ${pinnedCity.country}`;
    return "";
  }, [selectedCity, pinnedCity]);

  return (
    <Marker
      longitude={coords.lon}
      latitude={coords.lat}
      anchor="bottom"
      pitchAlignment="map"
      rotationAlignment="map"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          filter: `drop-shadow(0 4px 14px ${colors.glow})`,
          pointerEvents: "none",
          width: "120px",
        }}
      >
        <div
          style={{
            width: "100px",
            background: colors.bg,
            color: "#E8E8E8",
            padding: "5px 0",
            borderRadius: "10px",
            border: "1.5px solid rgba(255,255,255,0.22)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {locationLabel && (
            <span
              style={{
                fontSize: "11px",
                opacity: 0.85,
                marginBottom: "2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "90px",
              }}
            >
              {locationLabel}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: cfg.iconPaths }}
            />
            <span>{value}</span>
            {mapType === "wind_new" && display && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                style={{
                  transform: `rotate(${(((selectedTime === 0 ? omWind?.wind_deg : null) ?? display.wind_deg) + 180) % 360}deg)`,
                  flexShrink: 0,
                }}
              >
                <path
                  d="M6 1 L6 10 M3.5 3.5 L6 1 L8.5 3.5"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
          </div>
        </div>

        <svg
          width="16"
          height="11"
          viewBox="0 0 16 11"
          style={{ marginTop: "-1px" }}
        >
          <polygon points="8,11 0,0 16,0" fill={colors.bg} />
        </svg>
      </div>
    </Marker>
  );
}
