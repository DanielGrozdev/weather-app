import { createContext } from "react";

export type Units = "metric" | "imperial";

export const UNITS_STORAGE_KEY = "weather-app:units";
export const DEFAULT_UNITS: Units = "metric";

export type UnitsContextValue = {
  units: Units;
  setUnits: (u: Units) => void;
  toggle: () => void;
};

export const UnitsContext = createContext<UnitsContextValue | null>(null);
