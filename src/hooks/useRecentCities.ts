import { useCallback, useEffect, useState } from "react";
import { cityKey, type CityResult } from "../types";

const STORAGE_KEY = "weather-app:recent-cities";
const MAX_RECENTS = 5;

function readStored(): CityResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CityResult =>
        c &&
        typeof c.name === "string" &&
        typeof c.country === "string" &&
        typeof c.lat === "number" &&
        typeof c.lon === "number",
    );
  } catch {
    return [];
  }
}

/**
 * localStorage-backed list of recently selected cities, most-recent first.
 * `add` moves an existing entry to the front rather than duplicating it.
 */
export function useRecentCities() {
  const [recents, setRecents] = useState<CityResult[]>(readStored);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
    } catch {
      // storage full or disabled — silently ignore
    }
  }, [recents]);

  const add = useCallback((city: CityResult) => {
    setRecents((prev) => {
      const key = cityKey(city);
      const without = prev.filter((c) => cityKey(c) !== key);
      return [city, ...without].slice(0, MAX_RECENTS);
    });
  }, []);

  const clear = useCallback(() => setRecents([]), []);

  return { recents, add, clear };
}
