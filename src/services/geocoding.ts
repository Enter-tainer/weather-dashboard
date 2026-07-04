import { getCached, setCache, TTL_GEO } from './cache';
import type { CityDetails } from '../types/weather';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  timezone?: string;
  name: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

interface NominatimResponse {
  address?: Partial<Record<'city' | 'town' | 'village' | 'county' | 'state' | 'country', string>>;
}

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export async function getCityDetails(cityName: string): Promise<CityDetails> {
  const cacheKey = `geo:${cityName}`;
  const cached = getCached<CityDetails>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1&format=json`,
  );
  const data = (await res.json()) as GeocodingResponse;
  if (data.results && data.results.length > 0) {
    const firstResult = data.results[0];
    if (!firstResult) throw new Error(`City not found: ${cityName}`);
    const { latitude, longitude, timezone, name } = firstResult;
    const result = { latitude, longitude, timezone: timezone || 'auto', name };
    setCache(cacheKey, result, TTL_GEO);
    return result;
  }
  throw new Error(`City not found: ${cityName}`);
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  fallback = '当前位置',
): Promise<string> {
  const cacheKey = `reverse_geo:${coordKey(lat, lon)}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`,
      { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' } },
    );
    if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`);
    const data = (await res.json()) as NominatimResponse;
    const a = data.address || {};
    const name = a.city || a.town || a.village || a.county || a.state || a.country || fallback;
    setCache(cacheKey, name, TTL_GEO);
    return name;
  } catch {
    return fallback;
  }
}
