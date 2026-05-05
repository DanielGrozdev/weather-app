import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchCities } from "../api";
import { useDebouncedValue } from "./useDebouncedValue";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const STALE_MS = 5 * 60 * 1000;

/**
 * Debounced city search. Fires the OpenWeather geocode request only after the
 * user has stopped typing for `DEBOUNCE_MS` and the query is at least
 * `MIN_QUERY_LENGTH` characters. Previous results are kept while a new query
 * loads so the dropdown doesn't flicker between empty and populated states.
 */
export function useCitySearch(rawQuery: string) {
  const debounced = useDebouncedValue(rawQuery.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const query = useQuery({
    queryKey: ["cities", debounced],
    queryFn: () => searchCities(debounced, 5),
    enabled,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    debouncedQuery: debounced,
    isMinLength: enabled,
    /** True when the user has typed something and we're waiting on the debounce or the request. */
    isSearching:
      rawQuery.trim().length >= MIN_QUERY_LENGTH &&
      (rawQuery.trim() !== debounced || query.isFetching),
  };
}
