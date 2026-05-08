/**
 * useWindAtPoint — returns wind speed + FROM-direction for a single lat/lon
 * from the same Open-Meteo grid that WindParticlesLayer uses.
 *
 * Key design: coordsBoundsFor(lat, lon) places the center grid point at
 * exactly (lat, lon), so sampleGrid at those coordinates returns the raw
 * Open-Meteo value — identical to what the particle at the selected marker
 * location is flowing with.  Both consumers share the React Query cache entry
 * ["windGrid", minLat, maxLat, minLon, maxLon] so only one network request
 * is ever made per location.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  coordsBoundsFor,
  fetchWindGrid,
  sampleGrid,
  uvToWind,
} from "../lib/windGrid";
import type { Units } from "../context/units-context";

type Coords = { lat: number; lon: number };

export function useWindAtPoint(
  coords: Coords | null,
  units: Units,
  enabled = true,
): { wind_speed: number; wind_deg: number } | null {
  const bounds = coords ? coordsBoundsFor(coords.lat, coords.lon) : null;

  const { data: grid } = useQuery({
    queryKey: bounds
      ? [
          "windGrid",
          bounds.minLat,
          bounds.maxLat,
          bounds.minLon,
          bounds.maxLon,
        ]
      : ["windGrid", "disabled"],
    queryFn: () => fetchWindGrid(bounds!),
    staleTime: 10 * 60 * 1000,
    enabled: !!bounds && enabled,
    placeholderData: keepPreviousData,
  });

  if (!grid || !coords) return null;

  const { u, v } = sampleGrid(grid, coords.lat, coords.lon);
  return uvToWind(u, v, units);
}
