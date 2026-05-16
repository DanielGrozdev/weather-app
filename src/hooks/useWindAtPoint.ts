import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { WIND_QUERY_KEY, fetchWindData, sampleGrid, uvToWind } from '../lib/windGrid';
import type { Units } from '../context/UnitsContext';

type Coords = { lat: number; lon: number };

export function useWindAtPoint(
  coords: Coords | null,
  units: Units,
  enabled = true,
): { wind_speed: number; wind_deg: number } | null {
  const { data: grid } = useQuery({
    queryKey:  WIND_QUERY_KEY,
    queryFn:   fetchWindData,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime:    Infinity,
    enabled:   !!coords && enabled,
    placeholderData: keepPreviousData,
  });

  if (!grid || !coords) return null;

  const { u, v } = sampleGrid(grid, coords.lat, coords.lon);
  return uvToWind(u, v, units);
}
