import { useEffect, useMemo, useRef } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  type MapMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coords, CityResult, MapLayerType } from "../types";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getWeather, reverseGeocode } from "../api";
import { useUnits } from "../hooks/useUnits";
import { LAYER_CONFIG } from "../lib/consts";
import { WindParticlesLayer } from "./WindParticles";

const API_KEY = import.meta.env.VITE_API_KEY;
const MAPTILER_API_KEY = import.meta.env.VITE_MAP_TILER_KEY;
const MAPTILER_STYLE = `https://api.maptiler.com/maps/backdrop-dark/style.json?key=${MAPTILER_API_KEY}`;

type Props = {
  coords: Coords;
  onMapClick: (lat: number, lon: number) => void;
  mapType: MapLayerType;
  windParticlesEnabled?: boolean;
  selectedCity: CityResult | null;
};

function buildTileUrl(mapType: MapLayerType, apiKey: string): string {
  return `https://tile.openweathermap.org/map/${mapType}/{z}/{x}/{y}.png?appid=${apiKey}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeatherMap({
  coords,
  onMapClick,
  mapType,
  windParticlesEnabled,
  selectedCity,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const lastFlownCoords = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      // Clear the previous timer if the user is still dragging
      clearTimeout(timer);

      // Wait 150ms after the last resize event to recalculate the canvas
      timer = setTimeout(() => {
        if (mapRef.current) {
          // This resets the internal canvas resolution and fixes the stretch
          mapRef.current.resize();
        }
      }, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (
      coords.lat !== lastFlownCoords.current?.lat ||
      coords.lon !== lastFlownCoords.current?.lon
    ) {
      mapRef.current?.flyTo({
        center: [coords.lon, coords.lat],
        duration: 3000,
        essential: true,
      });
      // Update the ref so we don't fly again on the next re-render
      lastFlownCoords.current = { lat: coords.lat, lon: coords.lon };
    }
  }, [coords]);

  const tileUrl = useMemo(() => buildTileUrl(mapType, API_KEY), [mapType]);

  // Weather Layer
  const WeatherLayer = useMemo(
    () => (
      <Source
        id="weather-source"
        type="raster"
        tiles={[tileUrl]}
        tileSize={512}
        volatile={true}
      >
        <Layer
          id="weather-layer"
          type="raster"
          paint={{
            "raster-opacity": 0.7,
            "raster-fade-duration": 200,
          }}
        />
      </Source>
    ),
    [tileUrl],
  ); // Only rebuilds if the layer type/URL changes

  const handleMapClick = (e: MapMouseEvent) => {
    onMapClick(e.lngLat.lat, e.lngLat.lng);
  };

  return (
    <Map
      ref={mapRef}
      mapStyle={MAPTILER_STYLE}
      attributionControl={false}
      initialViewState={{
        latitude: coords.lat,
        longitude: coords.lon,
        zoom: 5,
      }}
      minZoom={1}
      maxZoom={10}
      reuseMaps
      localIdeographFontFamily={"sans-serif"}
      collectResourceTiming={false}
      trackResize={false}
      style={{ width: "100%", height: "100vh" }}
      onClick={handleMapClick}
      maxTileCacheSize={200}
      refreshExpiredTiles={false}
    >
      {WeatherLayer}

      <CustomMarker
        coords={coords}
        mapType={mapType}
        selectedCity={selectedCity}
      />

      <WindParticlesLayer enabled={windParticlesEnabled} coords={coords} />
    </Map>
  );
}

// ─── Marker ───────────────────────────────────────────────────────────────────

function CustomMarker({
  coords,
  mapType,
  selectedCity,
}: {
  coords: Coords;
  mapType: MapLayerType;
  selectedCity: CityResult | null;
}) {
  const { units } = useUnits();

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

  const display = data?.current ?? null;
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
