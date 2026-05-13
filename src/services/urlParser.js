// Format: ?route=location~display:date;location~display:date
// location = cityName | lat,lon
// ~ and display are optional
// ; separates entries
import { reverseGeocode } from './geocoding.js';

const COORD_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

function parseEntry(part) {
  const [locationSpec, date] = part.split(':');
  const [location, displayName] = locationSpec.split('~');

  if (COORD_RE.test(location)) {
    const [lat, lon] = location.split(',').map(Number);
    return { lat, lon, date, originalName: displayName || undefined };
  }

  return { city: location, date, originalName: displayName || location };
}

function coordinateFallbackName(lat, lon) {
  return `${lat}°, ${lon}°`;
}

async function resolveCoordinateNames(entries) {
  return Promise.all(entries.map(async entry => {
    if (entry.lat == null || entry.lon == null || entry.originalName) return entry;

    const originalName = await reverseGeocode(
      entry.lat,
      entry.lon,
      coordinateFallbackName(entry.lat, entry.lon)
    );
    return { ...entry, originalName };
  }));
}

export async function parseRoute() {
  const params = new URLSearchParams(window.location.search);
  const routeStr = params.get('route');

  if (!routeStr) {
    try {
      const coords = await getUserCoords();
      const cityName = await reverseGeocode(coords.latitude, coords.longitude);
      return generate7Days(null, null, cityName, coords.latitude, coords.longitude);
    } catch (e) {
      console.warn('Geolocation failed, falling back to Beijing:', e);
      return generate7Days('Beijing', null, '北京');
    }
  }

  return resolveCoordinateNames(routeStr.split(';').map(parseEntry));
}

// Parse route entries and group by date.
// Returns { dateSlots: [{date, entries: [{city?, lat?, lon?, originalName}, ...], activeIndex}] }
// where dateSlots with multiple entries support switching.
export async function parseSwitchableRoute() {
  const params = new URLSearchParams(window.location.search);
  const routeStr = params.get('route');
  if (!routeStr) return null;

  const entries = await resolveCoordinateNames(routeStr.split(';').map(parseEntry));

  // Group by date
  const dateMap = new Map();
  for (const entry of entries) {
    if (!dateMap.has(entry.date)) dateMap.set(entry.date, []);
    dateMap.get(entry.date).push(entry);
  }

  // Check if any date has multiple entries
  let hasSwitchable = false;
  for (const group of dateMap.values()) {
    if (group.length > 1) { hasSwitchable = true; break; }
  }
  if (!hasSwitchable) return null;

  const dateSlots = [];
  for (const [date, group] of dateMap) {
    dateSlots.push({ date, entries: group, activeIndex: 0 });
  }
  return { dateSlots };
}

// Build route for specific active selections
export function buildRouteForSelections(dateSlots) {
  return dateSlots.map(slot => {
    const entry = slot.entries[slot.activeIndex];
    return { ...entry, date: slot.date };
  });
}

// Convert an array of entries back to a string route
export function stringifyRoute(entries) {
  if (!entries || entries.length === 0) return '';
  return entries.map(entry => {
    let loc = entry.lat != null && entry.lon != null ? `${entry.lat},${entry.lon}` : (entry.city || '');
    if (entry.originalName && entry.originalName !== loc && entry.originalName !== entry.city) {
      loc += `~${entry.originalName}`;
    }
    return `${loc}:${entry.date}`;
  }).join(';');
}

export function generate7Days(city, _unused, originalName, lat, lon) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
    return lat != null
      ? { lat, lon, originalName, date }
      : { city, originalName, date };
  });
}

function getUserCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { timeout: 10000 }
    );
  });
}
