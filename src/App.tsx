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
import { useRef } from "react";

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

  const config = legendConfigMap[mapType];
  const mapOverlayRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-8">
      <div ref={mapOverlayRef} className="relative">
        <div className="absolute right-3 top-3 z-1100 pointer-events-auto">
          <button
            type="button"
            aria-label={overlaysVisible ? "Hide overlays" : "Show overlays"}
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
              <WeatherOverlay coords={coords} selectedCity={selectedCity} />
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
        />
        {overlaysVisible ? <Legend config={config} /> : null}
      </div>

      {/* <HourlyForecast coords={coords} />
      <DailyForecast coords={coords} /> */}
    </div>
  );
}

export default App;
