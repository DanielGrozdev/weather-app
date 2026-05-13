import type { Dispatch, SetStateAction } from "react";
import { Cloud, Droplets, Gauge, Thermometer, Wind } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MapLayerType } from "../../types";

type Props = {
  mapType: MapLayerType;
  setMapType: Dispatch<SetStateAction<MapLayerType>>;
  windParticlesEnabled: boolean;
  setWindParticlesEnabled: Dispatch<SetStateAction<boolean>>;
  isForecast?: boolean;
};

export default function LayerTypes({
  mapType,
  setMapType,
  windParticlesEnabled,
  setWindParticlesEnabled,
  isForecast = false,
}: Props) {
  const { t } = useTranslation();

  const items = [
    { value: "temp_new", labelKey: "layers.temperature", Icon: Thermometer },
    { value: "pressure_new", labelKey: "layers.pressure", Icon: Gauge },
    { value: "wind_new", labelKey: "layers.windSpeed", Icon: Wind },
    {
      value: "precipitation_new",
      labelKey: "layers.precipitation",
      Icon: Droplets,
    },
    { value: "clouds_new", labelKey: "layers.clouds", Icon: Cloud },
  ];
  return (
    <div className="w-[220px] rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden">
      <div className="p-2 space-y-2">
        {items.map((item) => {
          const active = item.value === mapType;
          const Icon = item.Icon;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setMapType(item.value as MapLayerType)}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                "text-sm transition-colors",
                active
                  ? "bg-primary text-white"
                  : "bg-muted/35 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="size-4.5 shrink-0 opacity-90" />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-border/70" />

      <div className="relative group p-3 flex items-center justify-between gap-3">
        <div
          className={[
            "text-sm transition-colors",
            isForecast ? "text-muted-foreground/40" : "text-muted-foreground",
          ].join(" ")}
        >
          {t("layers.windParticles")}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={windParticlesEnabled && !isForecast}
          disabled={isForecast}
          onClick={() => setWindParticlesEnabled((v) => !v)}
          className={[
            "relative w-12 h-7 rounded-full border-2 transition-colors",
            isForecast
              ? "bg-muted border-muted-foreground opacity-35 cursor-not-allowed"
              : windParticlesEnabled
                ? "bg-muted border-primary"
                : "bg-muted border-muted-foreground",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 size-5 rounded-full bg-primary shadow transition-transform",
              windParticlesEnabled && !isForecast
                ? "translate-x-5"
                : "translate-x-0",
            ].join(" ")}
          />
        </button>

        {isForecast && (
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex">
            <div className="whitespace-nowrap rounded-lg bg-card border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-lg">
              {t("layers.windParticlesLiveOnly")}
            </div>
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"
              style={{ marginTop: "-1px" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
