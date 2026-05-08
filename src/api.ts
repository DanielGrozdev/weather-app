import type { Units } from "./context/units-context";
import { GeocodeSchema } from "./schemas/geocodeSchema";
import { weatherSchema } from "./schemas/weatherSchema";
import { cityKey, type CityResult } from "./types";

const API_KEY = import.meta.env.VITE_API_KEY;

export async function getWeather({
  lat,
  lon,
  units,
}: {
  lat: number;
  lon: number;
  units: Units;
}) {
  const res = await fetch(
    `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=${units}&exclude=minutely,alerts&appid=${API_KEY}`,
  );
  const data = await res.json();

  return weatherSchema.parse(data);
}

/**
 * Search cities by free-text query via the OpenWeather direct geocode
 * endpoint. Returns up to `limit` results (default 5), de-duplicated by
 * (lat, lon, name) to remove the occasional duplicate OWM emits.
 */
export async function searchCities(
  query: string,
  limit = 5,
): Promise<CityResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("appid", API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`City search failed (${res.status})`);
  }
  const raw = GeocodeSchema.parse(await res.json());

  const seen = new Set<string>();
  const out: CityResult[] = [];
  for (const item of raw) {
    const c: CityResult = {
      name: item.name,
      country: item.country,
      state: item.state,
      lat: item.lat,
      lon: item.lon,
    };
    const key = cityKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Reverse-geocode a (lat, lon) pair to the nearest named place.
 * Returns null if the request fails or no result is found.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<CityResult | null> {
  const url = new URL("https://api.openweathermap.org/geo/1.0/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("limit", "1");
  url.searchParams.set("appid", API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const raw = GeocodeSchema.parse(await res.json());
  if (raw.length === 0) return null;

  const item = raw[0];
  return {
    name: item.name,
    country: item.country,
    state: item.state,
    lat: item.lat,
    lon: item.lon,
  };
}
