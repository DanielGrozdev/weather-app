import { useMemo } from "react";
import { Marker } from "react-map-gl/maplibre";
import { useUnits } from "../hooks/useUnits";
import { useDisplayWeather } from "../hooks/useDisplayWeather";
import { useEffectiveWind } from "../hooks/useEffectiveWind";
import { usePinnedCity } from "../hooks/usePinnedCity";
import { LAYER_CONFIG, type DisplayData } from "../lib/consts";
import { windToDeg } from "../lib/windGrid";
import type { CityResult, Coords, MapLayerType } from "../types";

type Props = {
  coords: Coords;
  mapType: MapLayerType;
  selectedCity: CityResult | null;
  selectedTime: number;
};

// Apply the effective wind to the data the layer config consumes, so the label
// and colour match the overlay panel for wind_new on live time.
function applyEffectiveWind(
  display: DisplayData,
  effective: { wind_speed: number; wind_deg: number } | null,
): DisplayData {
  if (!effective) return display;
  return { ...display, wind_speed: effective.wind_speed, wind_deg: effective.wind_deg };
}

export function CityMarker({ coords, mapType, selectedCity, selectedTime }: Props) {
  const { units } = useUnits();
  const { display: rawDisplay } = useDisplayWeather({ coords, units, selectedTime });
  const effectiveWind = useEffectiveWind(coords, units, rawDisplay, selectedTime);
  const { data: pinnedCity } = usePinnedCity(coords, selectedCity);

  const display = rawDisplay ? applyEffectiveWind(rawDisplay, effectiveWind) : null;

  const cfg = LAYER_CONFIG[mapType];
  const value = display ? cfg.getValue(display, units) : "–";
  const colors = display
    ? cfg.getColors(display, units)
    : { bg: "#6b7280", glow: "rgba(0,0,0,0.3)" };

  const locationLabel = useMemo(() => {
    if (selectedCity) return `${selectedCity.name}, ${selectedCity.country}`;
    if (pinnedCity) return `${pinnedCity.name}, ${pinnedCity.country}`;
    return "";
  }, [selectedCity, pinnedCity]);

  return (
    <Marker
      longitude={coords.lon}
      latitude={coords.lat}
      anchor="bottom"
      pitchAlignment="map"
      rotationAlignment="map"
    >
      <MarkerBadge
        bg={colors.bg}
        glow={colors.glow}
        label={locationLabel}
        value={value}
        iconPaths={cfg.iconPaths}
        windDeg={mapType === "wind_new" && display ? display.wind_deg : null}
      />
    </Marker>
  );
}

function MarkerBadge({
  bg,
  glow,
  label,
  value,
  iconPaths,
  windDeg,
}: {
  bg: string;
  glow: string;
  label: string;
  value: string;
  iconPaths: string;
  windDeg: number | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        filter: `drop-shadow(0 4px 14px ${glow})`,
        pointerEvents: "none",
        width: "120px",
      }}
    >
      <div
        style={{
          width: "100px",
          background: bg,
          color: "#E8E8E8",
          padding: "5px 0",
          borderRadius: "10px",
          border: "1.5px solid rgba(255,255,255,0.22)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {label && (
          <span
            style={{
              fontSize: "11px",
              opacity: 0.85,
              marginBottom: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "90px",
            }}
          >
            {label}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: iconPaths }}
          />
          <span>{value}</span>
          {windDeg !== null && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              style={{
                transform: `rotate(${windToDeg(windDeg)}deg)`,
                flexShrink: 0,
              }}
            >
              <path
                d="M6 1 L6 10 M3.5 3.5 L6 1 L8.5 3.5"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}
        </div>
      </div>

      <svg
        width="16"
        height="11"
        viewBox="0 0 16 11"
        style={{ marginTop: "-1px" }}
      >
        <polygon points="8,11 0,0 16,0" fill={bg} />
      </svg>
    </div>
  );
}
