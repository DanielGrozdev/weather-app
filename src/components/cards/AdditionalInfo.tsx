import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Card from "./Card";
import { getWeather } from "../../api";

import Cloud from "/src/assets/cloud.svg?react";
import Uv from "/src/assets/uv.svg?react";
import Pressure from "/src/assets/pressure.svg?react";
import Wind from "/src/assets/wind.svg?react";
import Sunrise from "/src/assets/sunrise.svg?react";
import Sunset from "/src/assets/sunset.svg?react";
import UpArrow from "/src/assets/uparrow.svg?react";
import type { Coords } from "../../types";
import { useUnits } from "../../hooks/useUnits";

type Props = {
  coords: Coords;
};

export default function AdditionalInfo({ coords }: Props) {
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
        title="Additional Weather Info"
        childrenClassName="flex flex-col gap-8"
      >
        <div className="h-56 rounded-lg bg-muted/30 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card
      title="Additional Weather Info"
      childrenClassName="flex flex-col gap-8"
      isRefreshing={isFetching}
    >
      {rows.map(({ label, value, Icon }) => (
        <div key={value} className="flex justify-between">
          <div className="flex gap-4">
            <span className="text-gray-500">{label}</span>
            <Icon className="size-8 invert" />
          </div>
          <FormatComponent value={value} number={data.current[value]} />
        </div>
      ))}
    </Card>
  );
}

function FormatComponent({ value, number }: { value: string; number: number }) {
  if (value === "sunrise" || value === "sunset")
    return new Date(number * 1000).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  if (value === "wind_deg")
    return (
      <UpArrow
        style={{
          transform: `rotate(${number}deg)`,
        }}
        className="size-8 invert"
      />
    );
  return number;
}

const rows = [
  {
    label: "Cloudiness (%)",
    value: "clouds",
    Icon: Cloud,
  },
  {
    label: "UV Index",
    value: "uvi",
    Icon: Uv,
  },
  {
    label: "Wind Direction",
    value: "wind_deg",
    Icon: Wind,
  },
  {
    label: "Pressure (hPa)",
    value: "pressure",
    Icon: Pressure,
  },
  {
    label: "Sunrise",
    value: "sunrise",
    Icon: Sunrise,
  },
  {
    label: "Sunset",
    value: "sunset",
    Icon: Sunset,
  },
] as const;
