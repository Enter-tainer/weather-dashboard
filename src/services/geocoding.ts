import { getCached, setCache, TTL_GEO } from './cache';
import type { CityDetails } from '../types/weather';

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

// Open-Meteo only matches ASCII names unless a language is requested, so Chinese
// queries (杭州 / 巫山 / 党岭) come back empty without `language=zh`.
const GEOCODING_LANGUAGE = 'zh';

export const GEO_SEARCH_LIMIT = 5;

interface GeocodingResult {
  latitude: number;
  longitude: number;
  timezone?: string;
  name: string;
  country?: string;
  admin1?: string;
  admin2?: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

interface NominatimResponse {
  address?: Partial<Record<'city' | 'town' | 'village' | 'county' | 'state' | 'country', string>>;
}

/** A single geocoding candidate — enough to disambiguate and to locate precisely. */
export interface GeoCandidate {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
}

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function toCandidate(result: GeocodingResult): GeoCandidate {
  return {
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    ...(result.timezone ? { timezone: result.timezone } : {}),
    ...(result.country ? { country: result.country } : {}),
    ...(result.admin1 ? { admin1: result.admin1 } : {}),
    ...(result.admin2 ? { admin2: result.admin2 } : {}),
  };
}

/**
 * Search cities by name (Chinese, pinyin or English) and return ranked candidates.
 * Results are cached per query so typeahead re-queries stay off the network.
 */
export async function searchCities(
  query: string,
  count: number = GEO_SEARCH_LIMIT,
): Promise<GeoCandidate[]> {
  const name = query.trim();
  if (!name) return [];

  const cacheKey = `geo:search:${count}:${name}`;
  const cached = getCached<GeoCandidate[]>(cacheKey);
  if (cached) return cached;

  const url =
    `${GEOCODING_ENDPOINT}?name=${encodeURIComponent(name)}` +
    `&count=${count}&language=${GEOCODING_LANGUAGE}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data = (await res.json()) as GeocodingResponse;
  const results = (data.results ?? []).map(toCandidate);
  setCache(cacheKey, results, TTL_GEO);
  return results;
}

const ADMIN_SUFFIX_RE = /(特别行政区|自治区|自治州|自治县|地区|新区|省|市|盟|县|区)$/;

function normalizeAdmin(value: string): string {
  return value.replace(ADMIN_SUFFIX_RE, '');
}

/**
 * Human-readable location chain, read like an address: 党岭 -> "四川 · 甘孜藏族自治州",
 * 巫山(朝鲜) -> "朝鲜 · Kangwŏn-do", 杭州 -> "浙江".
 * This is what tells 北京朝阳 apart from 辽宁朝阳 — no coordinates, no numbers.
 */
export function formatCitySubtitle(candidate: GeoCandidate): string {
  const name = normalizeAdmin(candidate.name);
  const parts: string[] = [];

  // 朝鲜/日本 等境外同名地，国家必须一起显示
  if (candidate.country && !candidate.country.includes('中国')) parts.push(candidate.country);

  for (const admin of [candidate.admin1, candidate.admin2]) {
    if (!admin) continue;
    if (normalizeAdmin(admin) === name) continue;
    if (parts.some((part) => normalizeAdmin(part) === normalizeAdmin(admin))) continue;
    parts.push(admin);
  }

  return parts.join(' · ');
}

export async function getCityDetails(cityName: string): Promise<CityDetails> {
  const cacheKey = `geo:${cityName}`;
  const cached = getCached<CityDetails>(cacheKey);
  if (cached) return cached;

  const [first] = await searchCities(cityName, 1);
  if (!first) throw new Error(`City not found: ${cityName}`);

  const result: CityDetails = {
    latitude: first.latitude,
    longitude: first.longitude,
    timezone: first.timezone || 'auto',
    name: first.name,
  };
  setCache(cacheKey, result, TTL_GEO);
  return result;
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
