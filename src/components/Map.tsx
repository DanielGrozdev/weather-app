import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { MaptilerLayer, MapStyle } from "@maptiler/leaflet-maptilersdk";
import "leaflet/dist/leaflet.css";
import type { Coords } from "../types";
import { useEffect } from "react";

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
};

export default function Map({
  coords,
  onMapClick,
  mapType,
  windParticlesEnabled,
}: Props) {
  const { lat, lon } = coords;

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={6}
      style={{
        width: "100%",
        height: "100vh",
      }}
      data-wind-particles={windParticlesEnabled ? "on" : "off"}
    >
      <MapController onMapClick={onMapClick} coords={coords} />
      <MapTileLayer />
      <TileLayer
        key={mapType}
        opacity={1}
        url={`https://tile.openweathermap.org/map/${mapType}/{z}/{x}/{y}.png?appid=${API_KEY}`}
        tileSize={256}
      />
      <Marker position={[lat, lon]} />
    </MapContainer>
  );
}

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
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
};

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
