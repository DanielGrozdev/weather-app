import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Card from "./Card";
import { getWeather } from "../../api";
import WeatherIcon from "../WeatherIcon";
import type { Coords } from "../../types";
import { useUnits } from "../../hooks/useUnits";
import { formatTemp } from "../../lib/format";

type Props = {
  coords: Coords;
};

export default function DailyForecast({ coords }: Props) {
  const { units } = useUnits();
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

  if (!data) {
    return (
      <Card title="Daily Forecast" childrenClassName="flex flex-col gap-4">
        <div className="h-56 rounded-lg bg-muted/30 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card
      title="Daily Forecast"
      childrenClassName="flex flex-col gap-4"
      isRefreshing={isFetching}
    >
      {data?.daily.map((day) => (
        <div key={day.dt} className="flex justify-between">
          <p className="w-9">
            {new Date(day.dt * 1000).toLocaleDateString(undefined, {
              weekday: "short",
            })}
          </p>
          <WeatherIcon src={day.weather[0].icon} />
          <p>{formatTemp(day.temp.day, units)}</p>
          <p className="text-gray-500/75">{formatTemp(day.temp.min, units)}</p>
          <p className="text-gray-500/75">{formatTemp(day.temp.max, units)}</p>
        </div>
      ))}
    </Card>
  );
}
