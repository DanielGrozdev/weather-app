export type Coords = {
  lat: number;
  lon: number;
};

/**
 * A geocoded city result from the OpenWeather direct geocode endpoint,
 * normalized to the fields we actually consume in the UI.
 */
export type CityResult = {
  name: string;
  country: string;
  state?: string;
  lat: number;
  lon: number;
};

/** Stable identity for a city used as a list key and de-dupe key. */
export function cityKey(c: CityResult): string {
  return `${c.lat.toFixed(4)}|${c.lon.toFixed(4)}|${c.name}`;
}
