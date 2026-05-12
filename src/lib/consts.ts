import type { Units } from "../context/UnitsContext";
import { formatTemp, formatWindSpeed } from "./format";
import type { MapLayerType } from "../types";

// ─── Legend ───────────────────────────────────────────────────────────────────

type LegendConfig = {
  label: string;
  min: string;
  max: string;
  gradient: string;
};

export const legendConfigMap: Record<MapLayerType, LegendConfig> = {
  precipitation_new: {
    label: "Precipitation",
    min: "0 mm/h",
    max: "40 mm/h",
    gradient:
      "linear-gradient(to right, rgba(225,200,100,0) 0%, rgba(150,150,170,0.2) 20%, rgba(120,120,190,0.4) 40%, rgba(90,90,210,0.6) 60%, rgba(60,60,230,0.85) 80%, rgba(20,20,255,1) 100%)",
  },
  temp_new: {
    label: "Temperature",
    min: "-65 °C",
    max: "30 °C",
    gradient:
      "linear-gradient(to right, #310052, #4b0082, #0000ff, #00ffff, #ffff00, #ff8c00, #ff0000, #8b0000)",
  },
  clouds_new: {
    label: "Clouds",
    min: "0 %",
    max: "100 %",
    gradient:
      "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(245,245,255,0.25) 20%, rgba(235,235,255,0.5) 40%, rgba(225,225,255,0.75) 60%, rgba(215,215,255,0.9) 80%, rgba(200,200,255,1) 100%)",
  },
  pressure_new: {
    label: "Pressure",
    min: "90000 Pa",
    max: "104000 Pa",
    gradient:
      "linear-gradient(to right, rgba(0,115,255,1) 0%, rgba(75,208,214,1) 25%, rgba(141,231,199,1) 50%, rgba(240,184,0,1) 70%, rgba(251,85,21,1) 85%, rgba(198,0,0,1) 100%)",
  },
  wind_new: {
    label: "Wind speed",
    min: "0 m/s",
    max: "29 m/s",
    gradient:
      "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(180,120,200,0.25) 15%, rgba(120,80,160,0.5) 30%, rgba(70,40,120,0.75) 55%, rgba(30,20,80,0.9) 80%, rgba(10,10,40,1) 100%)",
  },
};

// ─── Map marker layer config ───────────────────────────────────────────────────

export type MarkerColors = { bg: string; glow: string };

/** Minimal shape that both current + hourly data satisfy. */
export type DisplayData = {
  temp: number;
  wind_speed: number;
  wind_deg: number;
  pressure: number;
  humidity: number;
  clouds: number;
  pop?: number;
  rain?: { "1h": number };
  snow?: { "1h": number };
};

export type LayerConfig = {
  getValue: (d: DisplayData, units: Units) => string;
  getColors: (d: DisplayData, units: Units) => MarkerColors;
  iconPaths: string;
};

export const LAYER_CONFIG: Record<MapLayerType, LayerConfig> = {
  temp_new: {
    getValue: (d, units) => formatTemp(d.temp, units),
    getColors: (d, units) => {
      const c = units === "imperial" ? (d.temp - 32) * (5 / 9) : d.temp;
      if (c <= -15) return { bg: "#6d28d9", glow: "rgba(109,40,217,0.55)" };
      if (c <= -5) return { bg: "#2563eb", glow: "rgba(37,99,235,0.55)" };
      if (c <= 5) return { bg: "#0ea5e9", glow: "rgba(14,165,233,0.55)" };
      if (c <= 12) return { bg: "#10b981", glow: "rgba(16,185,129,0.55)" };
      if (c <= 20) return { bg: "#f59e0b", glow: "rgba(245,158,11,0.55)" };
      if (c <= 28) return { bg: "#f97316", glow: "rgba(249,115,22,0.55)" };
      return { bg: "#ef4444", glow: "rgba(239,68,68,0.55)" };
    },
    iconPaths:
      '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  },
  pressure_new: {
    getValue: (d) => `${Math.round(d.pressure)} hPa`,
    getColors: (d) => {
      const p = d.pressure;
      if (p < 960) return { bg: "#0073ff", glow: "rgba(0,115,255,0.55)" };
      if (p < 985) return { bg: "#4bd0d6", glow: "rgba(75,208,214,0.55)" };
      if (p < 1000) return { bg: "#8de7c7", glow: "rgba(141,231,199,0.55)" };
      if (p < 1015) return { bg: "#f0b800", glow: "rgba(240,184,0,0.55)" };
      if (p < 1025) return { bg: "#fb5515", glow: "rgba(251,85,21,0.55)" };
      return { bg: "#c60000", glow: "rgba(198,0,0,0.55)" };
    },
    iconPaths: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  },
  wind_new: {
    getValue: (d, units) => formatWindSpeed(d.wind_speed, units),
    getColors: (d, units) => {
      const ms = units === "imperial" ? d.wind_speed / 2.237 : d.wind_speed;
      if (ms < 2) return { bg: "#b478c8", glow: "rgba(180,120,200,0.55)" };
      if (ms < 7) return { bg: "#7850a0", glow: "rgba(120,80,160,0.55)" };
      if (ms < 14) return { bg: "#462878", glow: "rgba(70,40,120,0.55)" };
      if (ms < 21) return { bg: "#1e1450", glow: "rgba(30,20,80,0.55)" };
      return { bg: "#0a0a28", glow: "rgba(10,10,40,0.55)" };
    },
    iconPaths:
      '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>' +
      '<path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>' +
      '<path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  },
  precipitation_new: {
    getValue: (d) => {
      const mm = (d.rain?.["1h"] ?? 0) + (d.snow?.["1h"] ?? 0);
      return `${mm.toFixed(1)} mm/h`;
    },
    getColors: (d) => {
      const mm = (d.rain?.["1h"] ?? 0) + (d.snow?.["1h"] ?? 0);
      if (mm === 0) return { bg: "#4b5563", glow: "rgba(75,85,99,0.45)" };
      if (mm < 0.5) return { bg: "#9696aa", glow: "rgba(150,150,170,0.55)" };
      if (mm < 3) return { bg: "#7878be", glow: "rgba(120,120,190,0.55)" };
      if (mm < 8) return { bg: "#5a5ad2", glow: "rgba(90,90,210,0.55)" };
      if (mm < 20) return { bg: "#3c3ce6", glow: "rgba(60,60,230,0.55)" };
      return { bg: "#1414ff", glow: "rgba(20,20,255,0.55)" };
    },
    iconPaths:
      '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>' +
      '<path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  },
  clouds_new: {
    getValue: (d) => `${Math.round(d.clouds)} %`,
    getColors: (d) => {
      const c = d.clouds;
      if (c < 20) return { bg: "#374151", glow: "rgba(55,65,81,0.4)" };
      if (c < 50) return { bg: "#4b5563", glow: "rgba(75,85,99,0.45)" };
      if (c < 80) return { bg: "#6b7280", glow: "rgba(107,114,128,0.5)" };
      return { bg: "#9ca3af", glow: "rgba(156,163,175,0.55)" };
    },
    iconPaths:
      '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  },
};
