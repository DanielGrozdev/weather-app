import { useMemo } from "react";
import { useWeatherQuery } from "./useWeatherQuery";
import type { Units } from "../context/UnitsContext";
import type { Coords } from "../types";
import type { DisplayData } from "../lib/consts";

type Options = {
  coords: Coords;
  units: Units;
  selectedTime: number;
};

type Result = {
  display: DisplayData | null;
  isFetching: boolean;
};

// Returns the "displayed" weather slice — either `current` (live) or the
// hourly entry closest to `selectedTime` (forecast).
// Shared by WeatherOverlay and CityMarker so both render the same numbers.
export function useDisplayWeather({ coords, units, selectedTime }: Options): Result {
  const { data, isFetching } = useWeatherQuery(coords, units);

  const display = useMemo<DisplayData | null>(() => {
    if (!data) return null;
    if (selectedTime === 0 || !data.hourly.length) return data.current;
    return data.hourly.reduce((best, h) =>
      Math.abs(h.dt - selectedTime) < Math.abs(best.dt - selectedTime) ? h : best,
    );
  }, [data, selectedTime]);

  return { display, isFetching };
}
