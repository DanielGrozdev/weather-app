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

export default function HourlyForecast({ coords }: Props) {
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
      <Card
        title="Hourly Forecast (48 Hours)"
        childrenClassName="flex gap-6 overflow-x-scroll"
      >
        <div className="h-24 w-full rounded-lg bg-muted/30 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card
      title="Hourly Forecast (48 Hours)"
      childrenClassName="flex gap-6 overflow-x-scroll"
      isRefreshing={isFetching}
    >
      {data.hourly.map((hour) => (
        <div className="flex flex-col gap-2 items-center p-2" key={hour.dt}>
          <p className="whitespace-nowrap">
            {new Date(hour.dt * 1000).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
          <WeatherIcon src={hour.weather[0].icon} />
          <p>{formatTemp(hour.temp, units)}</p>
        </div>
      ))}
    </Card>
  );
}
