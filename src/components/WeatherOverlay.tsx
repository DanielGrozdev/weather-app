import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { getWeather } from "../api";
import { useUnits } from "../hooks/useUnits";
import { formatTemp, formatWindSpeed } from "../lib/format";
import type { CityResult, Coords } from "../types";
import WeatherIcon from "./WeatherIcon";
import UpArrow from "/src/assets/uparrow.svg?react";

type Props = {
  coords: Coords;
  selectedCity: CityResult | null;
  className?: string;
};

function formatCity(city: CityResult | null) {
  if (!city) return "Dropped pin";
  return [city.name, city.state, city.country].filter(Boolean).join(", ");
}

function formatCoords(coords: Coords) {
  return `${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}`;
}

export default function WeatherOverlay({ coords, selectedCity }: Props) {
  const { units } = useUnits();
  const [expanded, setExpanded] = useState(true);

  const { data, isFetching } = useQuery({
    queryKey: ["weather", coords.lat, coords.lon, units],
    queryFn: () =>
      getWeather({
        lat: coords.lat,
        lon: coords.lon,
        units,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="rounded-2xl min-w-70 border border-border bg-card/60 backdrop-blur-md shadow-2xl text-foreground overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">
              {formatCity(selectedCity)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCoords(coords)}
            </div>
          </div>

          {isFetching ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <span className="inline-block size-2 rounded-full bg-sky-400/80 animate-pulse" />
              <span className="hidden sm:inline">Refreshing</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="h-px bg-border/70" />

      <div className="px-4 py-3">
        {!data ? (
          <div className="h-24 rounded-xl bg-muted/30 animate-pulse" />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-4xl font-semibold tracking-tight">
                {formatTemp(data.current.temp, units)}
              </div>
              <WeatherIcon
                src={data.current.weather[0].icon}
                className="size-8 shrink-0"
              />
            </div>

            <button
              type="button"
              aria-label={expanded ? "Collapse details" : "Expand details"}
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

      {data && expanded ? (
        <div className="px-4 pb-4">
          <div className="h-px bg-border/70 mb-3" />
          <div className="space-y-2.5 text-sm">
            {[
              {
                label: "Feels like",
                value: formatTemp(data.current.feels_like, units),
              },
              {
                label: "Wind speed",
                value: formatWindSpeed(data.current.wind_speed, units),
              },
              {
                label: "Wind Direction",
                value: (
                  <UpArrow
                    style={{ transform: `rotate(${data.current.wind_deg}deg)` }}
                    className="size-5 opacity-90"
                  />
                ),
              },
              {
                label: "Humidity",
                value: `${Math.round(data.current.humidity)} %`,
              },
              {
                label: "Clouds",
                value: `${Math.round(data.current.clouds)} %`,
              },
              {
                label: "Pressure",
                value: `${Math.round(data.current.pressure)} hPa`,
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
