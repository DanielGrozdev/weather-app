import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWeather } from "../api";
import { useUnits } from "../hooks/useUnits";
import { formatTemp, formatWindSpeed } from "../lib/format";
import type { Coords } from "../types";
import UpArrow from "/src/assets/uparrow.svg?react";
import WeatherIcon from "./WeatherIcon";

// Must match the Tailwind classes on the hourly cards below.
// w-14 = 56px, gap-1.5 = 6px
const CARD_W = 56;
const CARD_GAP = 6;
const CARD_STEP = CARD_W + CARD_GAP; // 62px
const CHART_H = 40;
const PAD_Y = 4;
const TT_W = 140;
const TT_H = 38;

function cardCenterX(i: number) {
  return i * CARD_STEP + CARD_W / 2;
}

// ─── line chart ───────────────────────────────────────────────────────────────

function LineChart({
  values,
  timestamps,
  stroke,
  label,
  formatValue,
}: {
  values: number[];
  timestamps: number[];
  stroke: string;
  label: string;
  formatValue: (v: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const svgW = values.length * CARD_W + (values.length - 1) * CARD_GAP;

  const { polyline, area, ys, min, max } = useMemo(() => {
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 1;
    const ysArr = values.map(
      (v) => PAD_Y + (1 - (v - mn) / range) * (CHART_H - PAD_Y * 2),
    );
    const pts = values
      .map((_, i) => `${cardCenterX(i).toFixed(1)},${ysArr[i].toFixed(1)}`)
      .join(" ");
    const x0 = cardCenterX(0);
    const xN = cardCenterX(values.length - 1);
    return {
      polyline: pts,
      area: `${x0},${CHART_H} ${pts} ${xN},${CHART_H}`,
      ys: ysArr,
      min: mn,
      max: mx,
    };
  }, [values]);

  const gradId = `fdc-${label.replace(/\W/g, "")}`;

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x - CARD_W / 2) / CARD_STEP);
    setHoverIdx(Math.max(0, Math.min(values.length - 1, idx)));
  }

  const hx = hoverIdx !== null ? cardCenterX(hoverIdx) : null;
  const hy = hoverIdx !== null ? ys[hoverIdx] : null;
  const ttX = hx !== null ? (hx + 8 + TT_W > svgW ? hx - TT_W - 8 : hx + 8) : 0;

  return (
    <div>
      {/* Sticky label — stays at left edge while the chart scrolls */}
      <div className="sticky left-0 z-10 w-fit mb-1.5">
        <div className="flex items-baseline gap-2 rounded-md bg-card/90 backdrop-blur-sm px-2 py-0.5">
          <span className="text-[11px] font-medium text-foreground/80">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {formatValue(min)} – {formatValue(max)}
          </span>
        </div>
      </div>

      <svg
        width={svgW}
        height={CHART_H}
        viewBox={`0 0 ${svgW} ${CHART_H}`}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        className="block cursor-crosshair"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hx !== null && hy !== null && hoverIdx !== null && (
          <>
            <line
              x1={hx}
              y1={0}
              x2={hx}
              y2={CHART_H}
              stroke="white"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
            <circle
              cx={hx}
              cy={hy}
              r={4}
              fill={stroke}
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x={ttX}
              y={2}
              width={TT_W}
              height={TT_H}
              rx={5}
              fill="rgba(10,10,20,0.88)"
            />
            <text
              x={ttX + 7}
              y={15}
              fontSize={9}
              fill="rgba(156,163,175,1)"
              fontFamily="inherit"
            >
              {new Date(timestamps[hoverIdx] * 1000).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </text>
            <text
              x={ttX + 7}
              y={30}
              fontSize={12}
              fontWeight="600"
              fill="white"
              fontFamily="inherit"
            >
              {formatValue(values[hoverIdx])}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── section heading ─────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
          {title}
        </span>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

type Props = { coords: Coords };

export default function ForecastDrawer({ coords }: Props) {
  const { units } = useUnits();
  const { t, i18n } = useTranslation();

  const { data, isFetching } = useQuery({
    queryKey: ["weather", coords.lat, coords.lon, units],
    queryFn: () => getWeather({ lat: coords.lat, lon: coords.lon, units }),
    placeholderData: keepPreviousData,
  });

  const hours = useMemo(
    () =>
      data?.hourly.map((h) => ({
        dt: h.dt,
        time: new Date(h.dt * 1000).toLocaleTimeString(i18n.language, {
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }),
        temp: h.temp,
        icon: h.weather[0].icon,
        windDeg: h.wind_deg,
        windSpeed: h.wind_speed,
        humidity: h.humidity,
        pressure: h.pressure,
      })) ?? [],
    [data, i18n.language],
  );

  // Group consecutive hours by calendar day so we can render breakpoints.
  // Each group carries how many cards it spans so the header row stays
  // pixel-aligned with the flat card + chart row below.
  const dayGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    hours.forEach((h) => {
      const d = new Date(h.dt * 1000);
      const label = d.toLocaleDateString(i18n.language, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last?.label === label) {
        last.count++;
      } else {
        groups.push({ label, count: 1 });
      }
    });
    return groups;
  }, [hours, i18n.language]);

  const timestamps = useMemo(() => hours.map((h) => h.dt), [hours]);

  const refreshBadge = isFetching ? (
    <span className="size-1.5 rounded-full bg-sky-400/80 animate-pulse" />
  ) : null;

  if (!data) {
    return (
      <div className="px-4 pb-4 space-y-4">
        <div className="h-48 rounded-xl bg-muted/20 animate-pulse" />
        <div className="h-20 rounded-xl bg-muted/20 animate-pulse" />
      </div>
    );
  }

  const totalW = hours.length * CARD_W + (hours.length - 1) * CARD_GAP;

  return (
    <div className="px-4 pb-4 space-y-5">
      {/* ── Hourly cards + aligned charts — one unified horizontal scroll ── */}
      <Section title={t("forecast.next48h")} badge={refreshBadge}>
        <div className="overflow-x-auto -mx-4 px-4">
          <div style={{ width: totalW }}>
            {/* Day breakpoints — each cell spans exactly its day's cards */}
            <div className="flex gap-1.5 mb-2">
              {dayGroups.map(({ label, count }) => (
                <div
                  key={label}
                  style={{ width: count * CARD_W + (count - 1) * CARD_GAP }}
                  className="shrink-0"
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                  <div className="mt-0.5 h-px bg-white/10" />
                </div>
              ))}
            </div>

            {/* Cards */}
            <div className="flex gap-1.5 pb-3">
              {hours.map((h) => (
                <div
                  key={h.dt}
                  className="w-14 shrink-0 flex flex-col items-center gap-1.5 py-2 rounded-xl
                             bg-muted/15 hover:bg-muted/25 transition-colors"
                >
                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {h.time}
                  </span>
                  <WeatherIcon src={h.icon} className="size-6" />
                  <span className="text-xs font-medium tabular-nums">
                    {formatTemp(h.temp, units)}
                  </span>
                  <UpArrow
                    className="size-4 text-foreground/60"
                    style={{
                      transform: `rotate(${(h.windDeg + 180) % 360}deg)`,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {formatWindSpeed(h.windSpeed, units)}
                  </span>
                </div>
              ))}
            </div>

            {/* Charts — pixel-aligned with the cards above */}
            <div className="space-y-3 pb-2">
              <LineChart
                label={t("forecast.temperature")}
                values={hours.map((h) => h.temp)}
                timestamps={timestamps}
                stroke="#fb923c"
                formatValue={(v) => formatTemp(v, units)}
              />
              <LineChart
                label={t("forecast.humidity")}
                values={hours.map((h) => h.humidity)}
                timestamps={timestamps}
                stroke="#38bdf8"
                formatValue={(v) => `${Math.round(v)} %`}
              />
              <LineChart
                label={t("forecast.pressure")}
                values={hours.map((h) => h.pressure)}
                timestamps={timestamps}
                stroke="#c084fc"
                formatValue={(v) => `${Math.round(v)} hPa`}
              />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
