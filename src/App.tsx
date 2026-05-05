import Map from "./components/Map";
import DailyForecast from "./components/cards/DailyForecast";
import HourlyForecast from "./components/cards/HourlyForecast";
import CurrentWeather from "./components/cards/CurrentWeather";
import AdditionalInfo from "./components/cards/AdditionalInfo";
import MapTypeDropdown from "./components/dropdowns/MapTypeDropdown";
import CitySearch from "./components/search/CitySearch";
import { useWeatherApp } from "./hooks/useWeatherApp";

function App() {
  const { coords, selectedCity, selectCity, mapType, setMapType, onMapClick } =
    useWeatherApp();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-4 items-center">
        <h1 className="text-2xl font-semibold">Map Type:</h1>
        <MapTypeDropdown mapType={mapType} setMapType={setMapType} />
      </div>

      <div className="relative">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-1100 w-[min(560px,calc(100%-24px))]">
          <CitySearch
            selectedCity={selectedCity}
            onSelect={selectCity}
            className="mx-auto"
          />
        </div>
        <Map coords={coords} onMapClick={onMapClick} mapType={mapType} />
      </div>
      <CurrentWeather coords={coords} />
      <HourlyForecast coords={coords} />
      <DailyForecast coords={coords} />
      <AdditionalInfo coords={coords} />
    </div>
  );
}

export default App;
