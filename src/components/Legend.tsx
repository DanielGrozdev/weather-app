type LegendConfig = {
  label: string;
  min: string;
  max: string;
  gradient: string;
};

type Props = {
  config: LegendConfig;
  mapType: string;
};

export default function Legend({ config, mapType }: Props) {
  return (
    <div
      className="pointer-events-auto mr-4 mb-4 w-[300px]"
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <div className="rounded-lg bg-black/70 backdrop-blur-md shadow-2xl p-3 text-white ">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="whitespace-nowrap">{config.label}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="shrink-0 text-xs">{config.min}</span>

          <div
            className="h-3 w-full rounded opacity-70"
            style={{
              background: config.gradient,
              opacity: mapType === "clouds_new" ? 0.7 : 1,
            }}
          />
          <span className="shrink-0 text-xs">{config.max}</span>
        </div>
      </div>
    </div>
  );
}
