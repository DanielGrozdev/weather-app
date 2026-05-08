import { useCallback, useState } from "react";
import type { CityResult, Coords } from "../types";

const DEFAULT_CITY: CityResult = {
  name: "Varna",
  country: "BG",
  lat: 43.2,
  lon: 27.9,
};
const DEFAULT_MAP_TYPE = "temp_new";

/**
 * Centralizes the top-level state for the weather app:
 * - selectedCity: result picked from the city search (carries lat/lon, so no
 *   second geocode round-trip is needed)
 * - customCoords: coordinates from a map click (no associated city)
 * - active map overlay type
 * - desktop cards-rail visibility (used by the map layout in a later phase)
 *
 * `coords` is derived: customCoords win when set (the most recent intent),
 * otherwise the selected city, otherwise the Varna default.
 */
export function useWeatherApp() {
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(
    DEFAULT_CITY,
  );
  const [customCoords, setCustomCoords] = useState<Coords | null>(null);
  const [mapType, setMapType] = useState(DEFAULT_MAP_TYPE);
  const [cardsVisible, setCardsVisible] = useState(true);
  const [windParticlesEnabled, setWindParticlesEnabled] = useState(false);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  // Placeholder for time-aware layers (e.g. tiles that support `time=` param).
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState(0);

  const selectCity = useCallback((city: CityResult) => {
    setSelectedCity(city);
    setCustomCoords(null);
  }, []);

  const onMapClick = useCallback((lat: number, lon: number) => {
    setCustomCoords({ lat, lon });
    setSelectedCity(null);
  }, []);

  const toggleCards = useCallback(() => setCardsVisible((v) => !v), []);
  const toggleWindParticles = useCallback(
    () => setWindParticlesEnabled((v) => !v),
    [],
  );
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
    cardsVisible,
    toggleCards,
    windParticlesEnabled,
    setWindParticlesEnabled,
    toggleWindParticles,
    overlaysVisible,
    setOverlaysVisible,
    toggleOverlays,
    timeOffsetMinutes,
    setTimeOffsetMinutes,
  };
}
