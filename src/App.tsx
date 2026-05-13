import maplibregl from "maplibre-gl";
import Map from "./components/Map";
import LayerTypes from "./components/menus/LayerTypes";
import SettingsButton from "./components/menus/SettingsButton";
import CitySearch from "./components/search/CitySearch";
import { useWeatherApp } from "./hooks/useWeatherApp";
import Legend from "./components/Legend";
import { legendConfigMap } from "./lib/consts";
import WeatherOverlay from "./components/WeatherOverlay";
import BottomDrawer from "./components/BottomDrawer";
import ForecastDrawer from "./components/ForecastDrawer";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import TimeScrubber from "./components/TimeScrubber";
import Logo from "./assets/logo.svg";

// Set before map mounts
const logicalCores =
  typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
const workerCount = Math.min(Math.max(Math.floor(logicalCores / 2), 2), 6);
maplibregl.setWorkerCount(workerCount);
maplibregl.setMaxParallelImageRequests(32);
maplibregl.prewarm();

function App() {
  const {
    coords,
    selectedCity,
    selectCity,
    mapType,
    setMapType,
    onMapClick,
    windParticlesEnabled,
    setWindParticlesEnabled,
    overlaysVisible,
    toggleOverlays,
    customCoords,
    selectedTime,
    setSelectedTime,
  } = useWeatherApp();

  const { t } = useTranslation();
  const config = useMemo(() => legendConfigMap[mapType], [mapType]);
  const [isSyncing, setIsSyncing] = useState(false);

  return (
    // Mobile: flex column, map half-height + scrollable panel below.
    // Desktop (md+): display block, map fills full screen height.
    <div className="flex flex-col h-screen md:block">
      {/* ── Map area ──────────────────────────────────────────────────────── */}
      <div className="relative shrink-0 h-[50vh] md:h-screen">
        {/* Logo */}
        <div className="absolute left-2 top-2 z-1100 pointer-events-auto">
          <img
            src={Logo}
            alt="Breezy"
            className="h-14 select-none opacity-75"
            draggable={false}
          />
        </div>

        {/* Top-right controls */}
        <div className="absolute right-3 top-3 z-[1300] pointer-events-auto flex items-center gap-2">
          {/* Eye toggle — desktop only */}
          <button
            type="button"
            aria-label={t(
              overlaysVisible
                ? "controls.hideOverlays"
                : "controls.showOverlays",
            )}
            onClick={toggleOverlays}
            className="hidden md:grid size-10 rounded-full place-items-center border border-border bg-card backdrop-blur-md shadow-lg text-muted-foreground hover:text-foreground hover:bg-card/70 transition-colors"
          >
            {overlaysVisible ? (
              <Eye className="size-5" />
            ) : (
              <EyeOff className="size-5" />
            )}
          </button>

          <SettingsButton />
        </div>

        {/* City search — shown on all sizes, centred in map area */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-1100 w-[min(560px,calc(100%-24px))]">
          <CitySearch
            selectedCity={selectedCity}
            onSelect={selectCity}
            className="mx-auto"
          />
        </div>

        {/* Desktop-only overlay panels */}
        {overlaysVisible && (
          <>
            <div className="absolute left-3 top-24 z-1100 hidden md:block">
              <LayerTypes
                mapType={mapType}
                setMapType={setMapType}
                windParticlesEnabled={windParticlesEnabled}
                setWindParticlesEnabled={setWindParticlesEnabled}
                isForecast={selectedTime > 0}
              />
            </div>

            <div className="absolute right-3 top-24 z-1100 hidden md:block">
              <WeatherOverlay
                coords={coords}
                selectedCity={selectedCity}
                selectedTime={selectedTime}
              />
            </div>
          </>
        )}

        {/* Map */}
        <Map
          coords={coords}
          onMapClick={onMapClick}
          mapType={mapType}
          windParticlesEnabled={windParticlesEnabled && selectedTime === 0}
          selectedCity={selectedCity}
          onSyncingChange={setIsSyncing}
          customCoords={customCoords}
          selectedTime={selectedTime}
        />

        {/* Syncing indicator */}
        {isSyncing && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-1100 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground text-xs">
              <Loader2 className="size-3 animate-spin" />
              <span>{t("controls.loadingLayer")}</span>
            </div>
          </div>
        )}

        {/* Desktop-only: legend, time scrubber, forecast drawer */}
        {overlaysVisible && (
          <div className="hidden md:block">
            <Legend config={config} />
          </div>
        )}

        {overlaysVisible && (
          <div className="absolute z-1100 pointer-events-auto bottom-0 left-0 w-[300px] ml-4 mb-14 hidden md:block">
            <TimeScrubber
              selectedTime={selectedTime}
              onChange={setSelectedTime}
            />
          </div>
        )}

        <BottomDrawer className="hidden md:block">
          <ForecastDrawer coords={coords} />
        </BottomDrawer>
      </div>

      {/* ── Mobile-only panel below map ────────────────────────────────────── */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto bg-background">
        {/* Weather summary */}
        <WeatherOverlay
          coords={coords}
          selectedCity={selectedCity}
          selectedTime={selectedTime}
          className="rounded-none border-x-0 border-t-0 shadow-none"
        />

        {/* Layer picker + wind particles toggle */}
        <div className="border-t border-border">
          <LayerTypes
            mapType={mapType}
            setMapType={setMapType}
            windParticlesEnabled={windParticlesEnabled}
            setWindParticlesEnabled={setWindParticlesEnabled}
            isForecast={selectedTime > 0}
          />
        </div>

        {/* Time scrubber */}
        <div className="border-t border-border p-4">
          <TimeScrubber
            selectedTime={selectedTime}
            onChange={setSelectedTime}
          />
        </div>

        {/* Legend */}
        <div className="border-t border-border px-4 py-3">
          <Legend config={config} inline />
        </div>

        {/* Forecast */}
        <div className="border-t border-border">
          <ForecastDrawer coords={coords} />
        </div>
      </div>
    </div>
  );
}

export default App;
