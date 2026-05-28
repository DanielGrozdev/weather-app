import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { reverseGeocode } from "../api";
import type { CityResult, Coords } from "../types";

// Reverse-geocodes the pin location to the nearest named place. Disabled when
// the caller already has a selected city — saves a request on every pan.
export function usePinnedCity(coords: Coords, selectedCity: CityResult | null) {
  return useQuery({
    queryKey: ["reverseGeocode", coords.lat, coords.lon],
    queryFn: () => reverseGeocode(coords.lat, coords.lon),
    enabled: selectedCity === null,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}
