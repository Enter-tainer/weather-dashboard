// Format: ?route=location~display:date;location~display:date
// location = cityName | lat,lon
// ~ and display are optional
// ; separates entries
import { reverseGeocode } from './geocoding';
import type { DateSlot, RouteEntry, SwitchableRoute } from '../types/weather';
import { parseLocationSpec, stringifyLocationSpec } from './locationSpec';
import {
  getActiveReaderLocation,
  parseReaderLocation,
  saveReaderLocation,
  stringifyReaderLocation,
  type ReaderLocationConfig,
} from './readerLocation';

function parseEntry(part: string): RouteEntry {
  const [locationSpec = '', date = ''] = part.split(':');
  return { ...parseLocationSpec(locationSpec), date };
}

function coordinateFallbackName(lat: number, lon: number): string {
  return `${lat}°, ${lon}°`;
}

async function resolveCoordinateNames(entries: RouteEntry[]): Promise<RouteEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      if (entry.lat == null || entry.lon == null || entry.originalName) return entry;

      const originalName = await reverseGeocode(
        entry.lat,
        entry.lon,
        coordinateFallbackName(entry.lat, entry.lon),
      );
      return { ...entry, originalName };
    }),
  );
}

export async function parseRoute(): Promise<RouteEntry[]> {
  const params = new URLSearchParams(window.location.search);
  const routeStr = params.get('route');

  if (params.get('layout')?.toLowerCase() === 'reader') {
    let readerLocation = getActiveReaderLocation();
    if (!readerLocation && routeStr) {
      const [firstPart = ''] = routeStr.split(';');
      const [locationSpec = ''] = firstPart.split(':');
      readerLocation = parseReaderLocation(locationSpec);
    }

    if (readerLocation) {
      saveReaderLocation(readerLocation);
      return resolveCoordinateNames(generateReaderDays(readerLocation));
    }

    try {
      const coords = await getUserCoords();
      const cityName = await reverseGeocode(coords.latitude, coords.longitude);
      const detectedLocation = {
        location: `${coords.latitude},${coords.longitude}`,
        displayName: cityName,
      };
      saveReaderLocation(detectedLocation);
      return generateReaderDays(detectedLocation);
    } catch (error: unknown) {
      console.warn('Reader location is not configured and geolocation failed:', error);
      return [];
    }
  }

  if (!routeStr) {
    try {
      const coords = await getUserCoords();
      const cityName = await reverseGeocode(coords.latitude, coords.longitude);
      return generate7Days(null, null, cityName, coords.latitude, coords.longitude);
    } catch (e: unknown) {
      console.warn('Geolocation failed, falling back to Beijing:', e);
      return generate7Days('Beijing', null, '北京');
    }
  }

  return resolveCoordinateNames(routeStr.split(';').map(parseEntry));
}

// Parse route entries and group by date.
// Returns { dateSlots: [{date, entries: [{city?, lat?, lon?, originalName}, ...], activeIndex}] }
// where dateSlots with multiple entries support switching.
export async function parseSwitchableRoute(): Promise<SwitchableRoute | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.get('layout')?.toLowerCase() === 'reader') return null;
  const routeStr = params.get('route');
  if (!routeStr) return null;

  const entries = await resolveCoordinateNames(routeStr.split(';').map(parseEntry));

  // Group by date
  const dateMap = new Map<string, RouteEntry[]>();
  for (const entry of entries) {
    if (!dateMap.has(entry.date)) dateMap.set(entry.date, []);
    dateMap.get(entry.date)?.push(entry);
  }

  // Check whether a date has multiple entries
  let hasSwitchable = false;
  for (const group of dateMap.values()) {
    if (group.length > 1) {
      hasSwitchable = true;
      break;
    }
  }
  if (!hasSwitchable) return null;

  const dateSlots: DateSlot[] = [];
  for (const [date, group] of dateMap) {
    dateSlots.push({ date, entries: group, activeIndex: 0 });
  }
  return { dateSlots };
}

// Build route for specific active selections
export function buildRouteForSelections(dateSlots: DateSlot[]): RouteEntry[] {
  return dateSlots.map((slot) => {
    const entry = slot.entries[slot.activeIndex];
    if (!entry) return { date: slot.date };
    return { ...entry, date: slot.date };
  });
}

// Convert an array of entries back to a string route
export function stringifyRoute(entries: RouteEntry[]): string {
  if (!entries || entries.length === 0) return '';
  return entries
    .map((entry) => {
      return `${stringifyLocationSpec(entry)}:${entry.date}`;
    })
    .join(';');
}

export function generate7Days(
  city: string | null,
  _unused: null,
  originalName: string,
  lat?: number,
  lon?: number,
): RouteEntry[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
    return lat != null && lon != null
      ? { lat, lon, originalName, date }
      : { city: city ?? originalName, originalName, date };
  });
}

export function generateReaderDays(config: ReaderLocationConfig, days = 3): RouteEntry[] {
  const location = parseLocationSpec(stringifyReaderLocation(config));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return { ...location, date: date.toLocaleDateString('en-CA') };
  });
}

function getUserCoords(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(err.message)),
      { timeout: 10000 },
    );
  });
}
