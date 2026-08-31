import type { RouteEntry } from '../types/weather';

export type LocationSpec = Omit<RouteEntry, 'date'>;

const COORD_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export function parseLocationSpec(value: string): LocationSpec {
  const [location = '', displayName] = value.split('~');
  const normalizedLocation = location.trim();
  const normalizedDisplayName = displayName?.trim();

  if (COORD_RE.test(normalizedLocation)) {
    const [lat, lon] = normalizedLocation.split(',').map(Number);
    if (lat != null && lon != null) {
      return {
        lat,
        lon,
        ...(normalizedDisplayName ? { originalName: normalizedDisplayName } : {}),
      };
    }
  }

  return {
    city: normalizedLocation,
    originalName: normalizedDisplayName || normalizedLocation,
  };
}

export function stringifyLocationSpec(entry: LocationSpec): string {
  let location =
    entry.lat != null && entry.lon != null ? `${entry.lat},${entry.lon}` : entry.city || '';
  if (entry.originalName && entry.originalName !== location && entry.originalName !== entry.city) {
    location += `~${entry.originalName}`;
  }
  return location;
}
