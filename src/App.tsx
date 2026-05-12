import { prewarm } from "maplibre-gl";
import Map from "./components/Map";
import LayerTypes from "./components/menus/LayerTypes";
import CitySearch from "./components/search/CitySearch";
import { useWeatherApp } from "./hooks/useWeatherApp";
import Legend from "./components/Legend";
import { legendConfigMap } from "./lib/consts";
import WeatherOverlay from "./components/WeatherOverlay";
import BottomDrawer from "./components/BottomDrawer";
import ForecastDrawer from "./components/ForecastDrawer";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUnits } from "./hooks/useUnits";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";
import TimeScrubber from "./components/TimeScrubber";
import Logo from "./assets/logo.svg";

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

  const { units, toggle: toggleUnits } = useUnits();
  const { t } = useTranslation();
  const config = useMemo(() => legendConfigMap[mapType], [mapType]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    prewarm();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <div className="absolute left-2 top-2 z-1100 pointer-events-auto">
          <img
            src={Logo}
            alt="Breezy"
            className="h-12 select-none opacity-75"
            draggable={false}
          />
        </div>

        <div className="absolute right-3 top-3 z-1100 pointer-events-auto flex items-center gap-2">
          {/* Language switcher */}
          <LanguageSwitcher />

          {/* °C / °F toggle */}
          <button
            type="button"
            aria-label={t(
              units === "metric"
                ? "controls.switchToFahrenheit"
                : "controls.switchToCelsius",
            )}
            onClick={toggleUnits}
            className="h-10 px-3 rounded-full border border-border bg-card backdrop-blur-md shadow-lg text-muted-foreground hover:text-foreground hover:bg-card/70 transition-colors font-semibold text-sm tracking-tight"
          >
            °{units === "metric" ? "C" : "F"}
          </button>

          {/* Show / hide overlays */}
          <button
            type="button"
            aria-label={t(
              overlaysVisible
                ? "controls.hideOverlays"
                : "controls.showOverlays",
            )}
            onClick={toggleOverlays}
            className="size-10 rounded-full grid place-items-center border border-border bg-card backdrop-blur-md shadow-lg text-muted-foreground hover:text-foreground hover:bg-card/70 transition-colors"
          >
            {overlaysVisible ? (
              <Eye className="size-5" />
            ) : (
              <EyeOff className="size-5" />
            )}
          </button>
        </div>

        {overlaysVisible ? (
          <>
            <div className="absolute left-3 top-24 z-1100">
              <LayerTypes
                mapType={mapType}
                setMapType={setMapType}
                windParticlesEnabled={windParticlesEnabled}
                setWindParticlesEnabled={setWindParticlesEnabled}
              />
            </div>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-1100 w-[min(560px,calc(100%-24px))]">
              <CitySearch
                selectedCity={selectedCity}
                onSelect={selectCity}
                className="mx-auto"
              />
            </div>
            <div className="absolute right-3 top-24 z-1100">
              <WeatherOverlay coords={coords} selectedCity={selectedCity} selectedTime={selectedTime} />
            </div>
          </>
        ) : null}

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
        {isSyncing && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-1100 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground text-xs">
              <Loader2 className="size-3 animate-spin" />
              <span>{t("controls.loadingLayer")}</span>
            </div>
          </div>
        )}
        {overlaysVisible ? <Legend config={config} /> : null}

        {/* Time scrubber */}
        {overlaysVisible && (
          <div className="absolute bottom-0 left-0 w-[300px] ml-4 mb-14">
            <TimeScrubber
              selectedTime={selectedTime}
              onChange={setSelectedTime}
            />
          </div>
        )}

        <BottomDrawer>
          <ForecastDrawer coords={coords} />
        </BottomDrawer>
      </div>
    </div>
  );
}

export default App;
