import { useCallback, useState } from "react";
import type { CityResult, Coords, MapLayerType } from "../types";

const DEFAULT_CITY: CityResult = {
  name: "Varna",
  country: "BG",
  lat: 43.2,
  lon: 27.9,
};

export function useWeatherApp() {
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(DEFAULT_CITY);
  const [customCoords, setCustomCoords] = useState<Coords | null>(null);
  const [mapType, setMapType] = useState<MapLayerType>("temp_new");
  const [windParticlesEnabled, setWindParticlesEnabled] = useState(false);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  // 0 = live/current; any other value = Unix timestamp for a forecast step
  const [selectedTime, setSelectedTime] = useState(0);

  const selectCity = useCallback((city: CityResult) => {
    setSelectedCity(city);
    setCustomCoords(null);
  }, []);

  const onMapClick = useCallback((lat: number, lon: number) => {
    setCustomCoords({ lat, lon });
    setSelectedCity(null);
  }, []);

  const toggleOverlays = useCallback(() => setOverlaysVisible((v) => !v), []);

  // Round to 2 dp (~1 km grid) so all downstream React Query keys stay stable
  // while the user pans the map — prevents refetch churn on minor movements.
  const rawCoords: Coords =
    customCoords ??
    (selectedCity
      ? { lat: selectedCity.lat, lon: selectedCity.lon }
      : { lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });

  const coords: Coords = {
    lat: Math.round(rawCoords.lat * 100) / 100,
    lon: Math.round(rawCoords.lon * 100) / 100,
  };

  return {
    coords,
    selectedCity,
    selectCity,
    customCoords,
    mapType,
    setMapType,
    onMapClick,
    windParticlesEnabled,
    setWindParticlesEnabled,
    overlaysVisible,
    toggleOverlays,
    selectedTime,
    setSelectedTime,
  };
}
