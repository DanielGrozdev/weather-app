import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getWeather } from "../api";
import type { Units } from "../context/UnitsContext";
import type { Coords } from "../types";

// Shared weather query so ForecastDrawer and useDisplayWeather don't diverge.
export function useWeatherQuery(coords: Coords, units: Units) {
  return useQuery({
    queryKey: ["weather", coords.lat, coords.lon, units],
    queryFn: () => getWeather({ lat: coords.lat, lon: coords.lon, units }),
    placeholderData: keepPreviousData,
  });
}
