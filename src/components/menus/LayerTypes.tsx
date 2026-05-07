import type { Dispatch, SetStateAction } from "react";
import { Cloud, Droplets, Gauge, Thermometer, Wind } from "lucide-react";

type Props = {
  mapType: string;
  setMapType: Dispatch<SetStateAction<string>>;
  windParticlesEnabled: boolean;
  setWindParticlesEnabled: Dispatch<SetStateAction<boolean>>;
};

export default function LayerTypes({
  mapType,
  setMapType,
  windParticlesEnabled,
  setWindParticlesEnabled,
}: Props) {
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
              onClick={() => setMapType(item.value)}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                "text-sm transition-colors",
                active
                  ? "bg-primary text-white"
                  : "bg-muted/35 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="size-4.5 shrink-0 opacity-90" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-border/70" />

      <div className="p-3 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Wind particles</div>
        <button
          type="button"
          role="switch"
          aria-checked={windParticlesEnabled}
          onClick={() => setWindParticlesEnabled((v) => !v)}
          className={[
            "relative w-12 h-7 rounded-full border transition-colors",
            windParticlesEnabled
              ? "bg-primary/90 border-primary/50"
              : "bg-muted/50 border-border",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 size-6 rounded-full bg-background shadow-sm transition-transform",
              windParticlesEnabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}

const items = [
  { value: "temp_new", label: "Temperature", Icon: Thermometer },
  { value: "pressure_new", label: "Pressure", Icon: Gauge },
  { value: "wind_new", label: "Wind speed", Icon: Wind },
  { value: "precipitation_new", label: "Precipitation", Icon: Droplets },
  { value: "clouds_new", label: "Clouds", Icon: Cloud },
];
