export type Coords = {
  lat: number;
  lon: number;
};

export type MapLayerType =
  | "temp_new"
  | "pressure_new"
  | "wind_new"
  | "precipitation_new"
  | "clouds_new";

export type CityResult = {
  name: string;
  country: string;
  state?: string;
  lat: number;
  lon: number;
};

export function cityKey(c: CityResult): string {
  return `${c.lat.toFixed(4)}|${c.lon.toFixed(4)}|${c.name}`;
}
