/**
 * useWindAtPoint — wind speed + FROM-direction for a single lat/lon.
 *
 * Uses the same city-snapped React Query key as WindParticlesLayer:
 *   ["windGrid", snappedLat, snappedLon]
 *
 * If the particle layer has already fetched the grid for this city zone,
 * this hook reads straight from the React Query cache — zero extra requests.
 * If particles are disabled (or this is the first consumer), a single 25-point
 * batch fetch is made and cached for the entire session (staleTime: Infinity).
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  cityBoundsFor,
  citySnapFor,
  fetchWindGrid,
  sampleGrid,
  uvToWind,
} from "../lib/windGrid";
import type { Units } from "../context/UnitsContext";

type Coords = { lat: number; lon: number };

export function useWindAtPoint(
  coords: Coords | null,
  units: Units,
  enabled = true,
): { wind_speed: number; wind_deg: number } | null {
  const snap   = coords ? citySnapFor(coords.lat, coords.lon) : null;
  const bounds = snap   ? cityBoundsFor(snap.lat, snap.lon)  : null;

  const { data: grid } = useQuery({
    queryKey: snap
      ? ["windGrid", snap.lat, snap.lon]
      : ["windGrid", "disabled"],
    queryFn: () => fetchWindGrid(bounds!),
    staleTime: Infinity,  // same key as WindParticlesLayer → reads from cache
    gcTime: Infinity,
    enabled: !!snap && enabled,
    placeholderData: keepPreviousData,
  });

  if (!grid || !coords) return null;

  const { u, v } = sampleGrid(grid, coords.lat, coords.lon);
  return uvToWind(u, v, units);
}
