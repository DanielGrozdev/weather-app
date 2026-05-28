import type { Units } from "../context/UnitsContext";
import type { Coords } from "../types";
import type { DisplayData } from "../lib/consts";
import { useWindAtPoint } from "./useWindAtPoint";

type EffectiveWind = { wind_speed: number; wind_deg: number };

// Returns the wind speed/direction the UI should display for a point.
//
// On live time the unified wind-grid (Open-Meteo / static wind.json) is the
// canonical source — it feeds the particles and the POI markers, so the
// overlay and the selected-city tooltip have to agree with it.
//
// On forecast steps the grid only carries "now", so we fall back to the OWM
// hourly slice already chosen by useDisplayWeather.
export function useEffectiveWind(
  coords: Coords,
  units: Units,
  display: DisplayData | null,
  selectedTime: number,
): EffectiveWind | null {
  const live = selectedTime === 0;
  const grid = useWindAtPoint(coords, units, live);

  if (live && grid) return grid;
  if (!display) return null;
  return { wind_speed: display.wind_speed, wind_deg: display.wind_deg };
}
