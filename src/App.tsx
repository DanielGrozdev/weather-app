import Map from "./components/Map";
// import DailyForecast from "./components/cards/DailyForecast";
// import HourlyForecast from "./components/cards/HourlyForecast";
import LayerTypes from "./components/menus/LayerTypes";
import CitySearch from "./components/search/CitySearch";
import { useWeatherApp } from "./hooks/useWeatherApp";
import Legend from "./components/Legend";
import { legendConfigMap } from "./lib/consts";
import WeatherOverlay from "./components/WeatherOverlay";
import TimeScrubber from "./components/TimeScrubber";
import { Eye, EyeOff } from "lucide-react";
import { useMemo, useRef } from "react";
import { useUnits } from "./hooks/useUnits";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";
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
    timeOffsetMinutes,
    setTimeOffsetMinutes,
  } = useWeatherApp();

  const { units, toggle: toggleUnits } = useUnits();
  const { t } = useTranslation();
  const config = useMemo(() => legendConfigMap[mapType], [mapType]);
  const mapOverlayRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-8">
      <div ref={mapOverlayRef} className="relative">
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
              <WeatherOverlay
                coords={coords}
                selectedCity={selectedCity}
                timeOffsetMinutes={timeOffsetMinutes}
              />
            </div>
            <TimeScrubber
              containerRef={mapOverlayRef}
              valueMinutes={timeOffsetMinutes}
              onChangeMinutes={setTimeOffsetMinutes}
            />
          </>
        ) : null}

        <Map
          coords={coords}
          onMapClick={onMapClick}
          mapType={mapType}
          windParticlesEnabled={windParticlesEnabled}
          timeOffsetMinutes={timeOffsetMinutes}
          selectedCity={selectedCity}
        />
        {overlaysVisible ? <Legend config={config} mapType={mapType} /> : null}
      </div>

      {/* <HourlyForecast coords={coords} />
      <DailyForecast coords={coords} /> */}
    </div>
  );
}

export default App;
