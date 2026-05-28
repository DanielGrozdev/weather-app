import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WIND_QUERY_KEY, fetchWindData, type WindGrid } from "../lib/windGrid";

// Single place for wind-grid query config. All three consumers
// (WindParticles, WindPoiLayer, useWindAtPoint) sample the same cached grid,
// so they must agree on staleTime and gcTime.
export function useWindGrid(enabled = true): WindGrid | undefined {
  return useQuery({
    queryKey: WIND_QUERY_KEY,
    queryFn: fetchWindData,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: Infinity,
    enabled,
    placeholderData: keepPreviousData,
  }).data;
}
