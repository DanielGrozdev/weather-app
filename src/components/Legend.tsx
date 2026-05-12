type LegendConfig = {
  label: string;
  min: string;
  max: string;
  gradient: string;
};

type Props = {
  config: LegendConfig;
};

export default function Legend({ config }: Props) {
  return (
    <div
      className="pointer-events-auto mr-4 mb-14 w-[300px]"
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-2xl text-foreground p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="whitespace-nowrap">{config.label}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="shrink-0 text-xs">{config.min}</span>

          <div
            className="h-3 w-full rounded"
            style={{
              background: config.gradient,
              opacity: 0.7,
            }}
          />
          <span className="shrink-0 text-xs">{config.max}</span>
        </div>
      </div>
    </div>
  );
}
