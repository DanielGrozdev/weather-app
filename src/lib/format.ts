import type { Units } from "../context/units-context";

/**
 * Format a temperature value. The OpenWeather One Call API returns the value
 * already in the requested unit (°C for `metric`, °F for `imperial`), so this
 * only handles rounding and the unit suffix.
 */
export function formatTemp(
  value: number,
  units: Units,
  opts?: { withUnit?: boolean; digits?: number },
): string {
  const digits = opts?.digits ?? 0;
  const withUnit = opts?.withUnit ?? true;
  const rounded =
    digits === 0 ? Math.round(value).toString() : value.toFixed(digits);
  if (!withUnit) return rounded;
  return `${rounded}°${units === "metric" ? "C" : "F"}`;
}

/**
 * Wind speed comes back as m/s for `metric` and mph for `imperial`.
 */
export function formatWindSpeed(value: number, units: Units): string {
  return units === "metric"
    ? `${value.toFixed(1)} m/s`
    : `${value.toFixed(1)} mph`;
}

export function formatPressure(value: number): string {
  return `${Math.round(value)} hPa`;
}

export function tempUnitSymbol(units: Units): string {
  return units === "metric" ? "°C" : "°F";
}
