import type { Units } from "./context/units-context";

/**
 * Fetch current wind speed + direction from Open-Meteo for a single point.
 * Used to keep the overlay / marker tooltip consistent with the particle field
 * (both sourced from Open-Meteo / ECMWF rather than OpenWeatherMap).
 *
 * wind_speed is returned in m/s (metric) or mph (imperial) so it drops
 * straight into formatWindSpeed without further conversion.
 * wind_deg is the meteorological FROM-direction (0 = wind coming from north).
 */
export async function getOpenMeteoWind(
  lat: number,
  lon: number,
  units: Units,
): Promise<{ wind_speed: number; wind_deg: number }> {
  const windUnit = units === "imperial" ? "mph" : "ms";
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=${windUnit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo wind fetch failed (${res.status})`);
  const d = await res.json();
  return {
    wind_speed: d.current?.wind_speed_10m ?? 0,
    wind_deg: d.current?.wind_direction_10m ?? 0,
  };
}
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
