import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { getWeather, reverseGeocode } from "../api";
import { useWindAtPoint } from "../hooks/useWindAtPoint";
import { useUnits } from "../hooks/useUnits";
import { formatTemp, formatWindSpeed } from "../lib/format";
import type { CityResult, Coords } from "../types";
import WeatherIcon from "./WeatherIcon";
import UpArrow from "/src/assets/uparrow.svg?react";
import { useTranslation } from "react-i18next";

type Props = {
  coords: Coords;
  selectedCity: CityResult | null;
  timeOffsetMinutes?: number;
  className?: string;
};

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCity(
  selectedCity: CityResult | null,
  pinnedCity: CityResult | null | undefined,
  droppedPinLabel: string,
): string {
  const city = selectedCity ?? pinnedCity ?? null;
  if (!city) return droppedPinLabel;
  return [city.name, city.state, city.country].filter(Boolean).join(", ");
}

function formatCoords(coords: Coords) {
  return `${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}`;
}

function formatTimeLabel(offsetMinutes: number): string {
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = offsetMinutes > 0 ? "+" : "−";
  const dt = new Date(Date.now() + offsetMinutes * 60_000);
  const timeStr = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return `${sign}${h}h${m > 0 ? `${m}m` : ""} · ${timeStr}`;
}

// Infer type from getWeather return to avoid duplicating the schema shape.
type WeatherData = Awaited<ReturnType<typeof getWeather>>;

/** Pick the hourly forecast entry closest to the given time offset from now. */
function getDisplayData(data: WeatherData, offsetMinutes: number) {
  // Past offsets or zero: OWM hourly only covers future, use current
  if (offsetMinutes <= 0) return data.current;

  const targetTs = Date.now() / 1000 + offsetMinutes * 60;
  // Filter to entries at or after now (avoid showing stale past slots)
  const future = data.hourly.filter(
    (h) => h.dt >= Math.floor(Date.now() / 1000) - 1800,
  );
  if (future.length === 0) return data.current;

  return future.reduce((best, h) =>
    Math.abs(h.dt - targetTs) < Math.abs(best.dt - targetTs) ? h : best,
  );
}

// ─── component ──────────────────────────────────────────────────────────────

export default function WeatherOverlay({
  coords,
  selectedCity,
  timeOffsetMinutes = 0,
}: Props) {
  const { units } = useUnits();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  // Reverse-geocode when user dropped a pin (no city selected from search)
  const { data: pinnedCity, isFetching: geocoding } = useQuery({
    queryKey: ["reverseGeocode", coords.lat, coords.lon],
    queryFn: () => reverseGeocode(coords.lat, coords.lon),
    enabled: selectedCity === null,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

  const { data, isFetching } = useQuery({
    queryKey: ["weather", coords.lat, coords.lon, units],
    queryFn: () => getWeather({ lat: coords.lat, lon: coords.lon, units }),
    placeholderData: keepPreviousData,
  });

  // Samples the same wind grid as WindParticlesLayer — guaranteed to match
  // the particle direction at this location (identical React Query cache entry).
  const omWind = useWindAtPoint(coords, units);

  const display = useMemo(
    () => (data ? getDisplayData(data, timeOffsetMinutes) : null),
    [data, timeOffsetMinutes],
  );

  const isForecast = timeOffsetMinutes > 0;

  return (
    <div className="rounded-2xl min-w-70 border border-border bg-card/60 backdrop-blur-md shadow-2xl text-foreground overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">
              {geocoding && selectedCity === null
                ? t("overlay.locating")
                : formatCity(selectedCity, pinnedCity, t("overlay.droppedPin"))}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCoords(coords)}
            </div>
          </div>

          {isFetching ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 shrink-0">
              <span className="inline-block size-2 rounded-full bg-sky-400/80 animate-pulse" />
              <span className="hidden sm:inline">
                {t("overlay.refreshing")}
              </span>
            </div>
          ) : null}
        </div>

        {/* Forecast time badge */}
        {isForecast ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-sky-400/90">
            <Clock className="size-3 shrink-0" />
            <span className="tabular-nums">
              {formatTimeLabel(timeOffsetMinutes)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="h-px bg-border/70" />

      {/* ── Summary ── */}
      <div className="px-4 py-3">
        {!display ? (
          <div className="h-24 rounded-xl bg-muted/30 animate-pulse" />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="tracking-tight">
                <div className="flex flex-col text-4xl font-semibold">
                  <span>{formatTemp(display.temp, units)}</span>
                  <span className="text-sm font-light">
                    {t("overlay.feelsLike")}{" "}
                    {formatTemp(display.feels_like, units)}
                  </span>
                </div>
              </div>
              <WeatherIcon
                src={display.weather[0].icon}
                className="size-8 shrink-0"
              />
            </div>

            <button
              type="button"
              aria-label={t(
                expanded ? "overlay.collapseDetails" : "overlay.expandDetails",
              )}
              onClick={() => setExpanded((v) => !v)}
              className={[
                "size-9 rounded-full grid place-items-center",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/50 transition-colors",
              ].join(" ")}
            >
              <ChevronDown
                className={[
                  "size-5 transition-transform duration-200",
                  expanded ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>
          </div>
        )}
      </div>

      {/* ── Expanded detail rows ── */}
      {display && expanded ? (
        <div className="px-4 pb-4">
          <div className="h-px bg-border/70 mb-3" />
          <div className="space-y-2.5 text-sm">
            {[
              {
                label: t("overlay.feelsLike"),
                value: formatTemp(display.feels_like, units),
              },
              {
                label: t("overlay.windSpeed"),
                value: formatWindSpeed(
                  omWind?.wind_speed ?? display.wind_speed,
                  units,
                ),
              },
              {
                label: t("overlay.windDirection"),
                value: (
                  <UpArrow
                    style={{
                      transform: `rotate(${((omWind?.wind_deg ?? display.wind_deg) + 180) % 360}deg)`,
                    }}
                    className="size-5 opacity-90"
                  />
                ),
              },
              {
                label: t("overlay.humidity"),
                value: `${Math.round(display.humidity)} %`,
              },
              {
                label: t("overlay.clouds"),
                value: `${Math.round(display.clouds)} %`,
              },
              {
                label: t("overlay.pressure"),
                value: `${Math.round(display.pressure)} hPa`,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
