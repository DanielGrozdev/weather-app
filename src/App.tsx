import Map from "./components/Map";
import DailyForecast from "./components/cards/DailyForecast";
import HourlyForecast from "./components/cards/HourlyForecast";
import CurrentWeather from "./components/cards/CurrentWeather";
import AdditionalInfo from "./components/cards/AdditionalInfo";
import LayerTypes from "./components/menus/LayerTypes";
import CitySearch from "./components/search/CitySearch";
import { useWeatherApp } from "./hooks/useWeatherApp";
import Legend from "./components/Legend";
import { legendConfigMap } from "./lib/consts";

function App() {
  const { coords, selectedCity, selectCity, mapType, setMapType, onMapClick } =
    useWeatherApp();
  const config = legendConfigMap[mapType];

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <div className="absolute left-1/2 top-16 -translate-x-1/2 z-1100">
          <LayerTypes mapType={mapType} setMapType={setMapType} />
        </div>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-1100 w-[min(560px,calc(100%-24px))]">
          <CitySearch
            selectedCity={selectedCity}
            onSelect={selectCity}
            className="mx-auto"
          />
        </div>
        <Map coords={coords} onMapClick={onMapClick} mapType={mapType} />
        <Legend config={config} />
      </div>

      <CurrentWeather coords={coords} />
      <HourlyForecast coords={coords} />
      <DailyForecast coords={coords} />
      <AdditionalInfo coords={coords} />
    </div>
  );
}

export default App;
