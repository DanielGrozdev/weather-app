import clsx from "clsx";

type WeatherIconProps = {
  src: string;
  className?: string;
};

export default function WeatherIcon({ src, className }: WeatherIconProps) {
  return (
    <img
      src={`https://openweathermap.org/img/wn/${src}.png`}
      className={clsx("size-8", className)}
    />
  );
}
