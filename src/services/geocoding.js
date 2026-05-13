import { getCached, setCache, TTL_GEO } from './cache.js';

function coordKey(lat, lon) {
  return `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
}

export async function getCityDetails(cityName) {
  const cacheKey = `geo:${cityName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1&format=json`);
  const data = await res.json();
  if (data.results && data.results.length > 0) {
    const { latitude, longitude, timezone, name } = data.results[0];
    const result = { latitude, longitude, timezone: timezone || 'auto', name };
    setCache(cacheKey, result, TTL_GEO);
    return result;
  }
  throw new Error(`City not found: ${cityName}`);
}

export async function reverseGeocode(lat, lon, fallback = '当前位置') {
  const cacheKey = `reverse_geo:${coordKey(lat, lon)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`,
      { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' } }
    );
    if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`);
    const data = await res.json();
    const a = data.address || {};
    const name = a.city || a.town || a.village || a.county || a.state || a.country || fallback;
    setCache(cacheKey, name, TTL_GEO);
    return name;
  } catch {
    return fallback;
  }
}
