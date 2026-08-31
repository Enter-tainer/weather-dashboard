export interface ReaderLocationConfig {
  location: string;
  displayName?: string | undefined;
}

const READER_LOCATION_STORAGE_KEY = 'weather-dashboard-reader-location';

export function normalizeReaderLocation(config: ReaderLocationConfig): ReaderLocationConfig | null {
  const location = config.location.trim();
  const displayName = config.displayName?.trim();
  if (!location) return null;
  return { location, ...(displayName ? { displayName } : {}) };
}

export function parseReaderLocation(value: string | null): ReaderLocationConfig | null {
  if (!value) return null;
  const parsed = parseLocationSpec(value);
  const location =
    parsed.lat != null && parsed.lon != null ? `${parsed.lat},${parsed.lon}` : parsed.city || '';
  return normalizeReaderLocation({ location, displayName: parsed.originalName });
}

export function stringifyReaderLocation(config: ReaderLocationConfig): string {
  const normalized = normalizeReaderLocation(config);
  if (!normalized) return '';
  return stringifyLocationSpec(
    parseLocationSpec(
      normalized.displayName
        ? `${normalized.location}~${normalized.displayName}`
        : normalized.location,
    ),
  );
}

export function loadSavedReaderLocation(): ReaderLocationConfig | null {
  try {
    return parseReaderLocation(window.localStorage.getItem(READER_LOCATION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveReaderLocation(config: ReaderLocationConfig): void {
  const value = stringifyReaderLocation(config);
  if (!value) throw new Error('常驻地点不能为空');
  try {
    window.localStorage.setItem(READER_LOCATION_STORAGE_KEY, value);
  } catch {
    // The URL remains the source of truth when storage is unavailable.
  }
}

export function getReaderLocationFromUrl(
  search = window.location.search,
): ReaderLocationConfig | null {
  return parseReaderLocation(new URLSearchParams(search).get('location'));
}

export function getActiveReaderLocation(
  search = window.location.search,
): ReaderLocationConfig | null {
  const params = new URLSearchParams(search);
  if (params.get('layout')?.toLowerCase() !== 'reader') return null;
  return parseReaderLocation(params.get('location')) ?? loadSavedReaderLocation();
}

export function isReaderWeatherScreen(search = window.location.search): boolean {
  return new URLSearchParams(search).get('layout')?.toLowerCase() === 'reader';
}
import { parseLocationSpec, stringifyLocationSpec } from './locationSpec';
