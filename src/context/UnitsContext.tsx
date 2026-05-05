import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_UNITS,
  UNITS_STORAGE_KEY,
  UnitsContext,
  type Units,
} from "./units-context";

function readStoredUnits(): Units {
  if (typeof window === "undefined") return DEFAULT_UNITS;
  const raw = window.localStorage.getItem(UNITS_STORAGE_KEY);
  return raw === "imperial" || raw === "metric" ? raw : DEFAULT_UNITS;
}

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<Units>(readStoredUnits);

  useEffect(() => {
    window.localStorage.setItem(UNITS_STORAGE_KEY, units);
  }, [units]);

  const setUnits = useCallback((u: Units) => setUnitsState(u), []);
  const toggle = useCallback(
    () => setUnitsState((u) => (u === "metric" ? "imperial" : "metric")),
    [],
  );

  return (
    <UnitsContext.Provider value={{ units, setUnits, toggle }}>
      {children}
    </UnitsContext.Provider>
  );
}
