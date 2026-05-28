import { sampleGrid, uvToWind } from '../lib/windGrid';
import type { Units } from '../context/UnitsContext';
import { useWindGrid } from './useWindGrid';

type Coords = { lat: number; lon: number };

export function useWindAtPoint(
  coords: Coords | null,
  units: Units,
  enabled = true,
): { wind_speed: number; wind_deg: number } | null {
  const grid = useWindGrid(!!coords && enabled);

  if (!grid || !coords) return null;

  const { u, v } = sampleGrid(grid, coords.lat, coords.lon);
  return uvToWind(u, v, units);
}
