// Format: ?route=location~display:date;location~display:date
// location = cityName | lat,lon
// ~ and display are optional
// ; separates entries

const COORD_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

function parseEntry(part) {
  const [locationSpec, date] = part.split(':');
  const [location, displayName] = locationSpec.split('~');

  if (COORD_RE.test(location)) {
    const [lat, lon] = location.split(',').map(Number);
    const originalName = displayName || `${lat}°, ${lon}°`;
    return { lat, lon, date, originalName };
  }

  return { city: location, date, originalName: displayName || location };
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

  return routeStr.split(';').map(parseEntry);
}

// Parse route entries and group by date.
// Returns { dateSlots: [{date, entries: [{city?, lat?, lon?, originalName}, ...], activeIndex}] }
// where dateSlots with multiple entries support switching.
export function parseSwitchableRoute() {
  const params = new URLSearchParams(window.location.search);
  const routeStr = params.get('route');
  if (!routeStr) return null;

  const entries = routeStr.split(';').map(parseEntry);

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

function generate7Days(city, _unused, originalName, lat, lon) {
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

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`,
      { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' } }
    );
    const data = await res.json();
    const a = data.address || {};
    return a.city || a.town || a.village || a.county || a.state || a.country || '当前位置';
  } catch {
    return '当前位置';
  }
}
