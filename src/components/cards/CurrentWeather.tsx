import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getWeather } from "../../api";
import Card from "./Card";
import WeatherIcon from "../WeatherIcon";
import type { Coords } from "../../types";
import { useUnits } from "../../hooks/useUnits";
import { formatTemp, formatWindSpeed } from "../../lib/format";

type Props = {
  coords: Coords;
};

export default function CurrentWeather({ coords }: Props) {
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
      <Card title="Current Weather" childrenClassName="flex flex-col gap-6">
        <div className="h-40 rounded-lg bg-muted/30 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card
      title="Current Weather"
      childrenClassName="flex flex-col items-center gap-6"
      isRefreshing={isFetching}
    >
      <div className="flex flex-col gap-2 items-center">
        <h2 className="text-6xl font-semibold text-centers">
          {formatTemp(data.current.temp, units)}
        </h2>
        <WeatherIcon src={data.current.weather[0].icon} className="size-14" />
        <h3 className="capitalize text-xl">
          {data.current.weather[0].description}
        </h3>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xl text-center">Local Time:</p>
        <h3 className="text-4xl font-semibold">
          {new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: data.timezone,
          }).format(new Date(data.current.dt))}
        </h3>
      </div>
      <div className="flex justify-between w-full">
        <div className="flex flex-col item-center gap-2">
          <p className="text-gray-500">Feels Like</p>
          <p>{formatTemp(data.current.feels_like, units)}</p>
        </div>
        <div className="flex flex-col item-center gap-2">
          <p className="text-gray-500">Humidity</p>
          <p>{Math.round(data.current.humidity)}%</p>
        </div>
        <div className="flex flex-col item-center gap-2">
          <p className="text-gray-500">Wind</p>
          <p>{formatWindSpeed(data.current.wind_speed, units)}</p>
        </div>
      </div>
    </Card>
  );
}
