import { cachedFetch, TTL_WEATHER } from './cache';
import { sampleLineAlong, type LatLng } from './geo';
import { APPROX_PRESSURE_HEIGHTS, SOUNDING_PRESSURE_LEVELS } from './sounding';
import type { CloudLevel, NullableNumber, SunEventType, WeatherPoint } from '../types/weather';
import type { SunDirectionInfo } from './sunDirection';

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Downrange sampling distances (km) along the sunrise/sunset azimuth. Extends to 300 km so the
 * cross-section reaches the high clouds (cirrus, ~10 km) that stay sunlit — and visible — well
 * beyond 140 km during deep twilight (a 10 km cloud is visible to ~360 km; the grazing ray at
 * α ≈ −3° lights clouds out to ~330 km). Spacing stays ~20–40 km, matching the ~9–13 km global
 * model resolution. 11 points × the slim cloud field set stays a single light request.
 */
export const SUN_SECTION_DISTANCES_KM = [0, 20, 40, 60, 80, 100, 140, 180, 220, 260, 300] as const;

/** Canvas height (CSS px) for the cross-section in the drawer. */
export const SUN_CLOUD_PLOT_HEIGHT = 410;

export interface CloudSectionColumn {
  lat: number;
  lon: number;
  distanceKm: number;
  cloudByLevel: CloudLevel[] | undefined;
  cloudLow: NullableNumber;
  cloudMid: NullableNumber;
  cloudHigh: NullableNumber;
}

export interface CloudSection {
  origin: LatLng;
  eventType: SunEventType;
  eventTrueMs: number;
  bearingDeg: number;
  altitudeDeg: number;
  columns: CloudSectionColumn[];
}

// Minimal view of the per-location Open-Meteo response object.
interface OpenMeteoHourly {
  time?: string[];
  [key: string]: unknown;
}
interface OpenMeteoLocation {
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  hourly: OpenMeteoHourly;
}

/** Per-pressure-level cloud cover + geopotential height fields for the cross-section. */
function cloudLevelFields(): string[] {
  return SOUNDING_PRESSURE_LEVELS.flatMap((p) => [
    `cloud_cover_${p}hPa`,
    `geopotential_height_${p}hPa`,
  ]);
}

/**
 * Build a single multi-coordinate Open-Meteo forecast URL covering all sample points.
 */
export function buildSunCloudSectionUrl(
  origin: LatLng,
  bearingDeg: number,
  distancesKm: readonly number[],
  dateStr: string,
): string {
  const points = sampleLineAlong(origin, bearingDeg, distancesKm);
  const latitudes = points.map((p) => p.lat.toFixed(4)).join(',');
  const longitudes = points.map((p) => p.lon.toFixed(4)).join(',');
  const hourly = [
    'cloud_cover_low',
    'cloud_cover_mid',
    'cloud_cover_high',
    ...cloudLevelFields(),
  ].join(',');
  const params = new URLSearchParams({
    latitude: latitudes,
    longitude: longitudes,
    hourly,
    timezone: 'auto',
    start_date: dateStr,
    end_date: dateStr,
  });
  return `${FORECAST_BASE}?${params.toString()}`;
}

/** Find the hourly bucket index nearest to `eventTrueMs` for a location. */
function nearestHourIndex(location: OpenMeteoLocation, eventTrueMs: number): number {
  const times = location.hourly.time;
  if (!times || times.length === 0) return -1;
  const offsetMs = location.utc_offset_seconds * 1000;
  let best = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (!t) continue;
    // API returns local-clock strings (no offset); convert to true UTC ms like api.ts toUtc.
    const localMs = new Date(t).getTime();
    if (!Number.isFinite(localMs)) continue;
    // drift = targetOffset - browserOffset; toUtc = localMs - drift = localMs - (offset - browserOffset)
    const browserOffsetMs = -new Date(t).getTimezoneOffset() * 60000;
    const trueMs = localMs - (offsetMs - browserOffsetMs);
    const delta = Math.abs(trueMs - eventTrueMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
}

/** Coerce an unknown hourly array slot to a finite number, else null. */
function numberAt(hourly: OpenMeteoHourly, field: string, i: number): NullableNumber {
  const arr = hourly[field];
  if (!Array.isArray(arr)) return null;
  const v = arr[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function buildCloudByLevel(hourly: OpenMeteoHourly, i: number): CloudLevel[] | undefined {
  const levels: CloudLevel[] = SOUNDING_PRESSURE_LEVELS.map((p) => ({
    pressure: p,
    cover: numberAt(hourly, `cloud_cover_${p}hPa`, i),
    altitude: numberAt(hourly, `geopotential_height_${p}hPa`, i),
  }));
  const hasAny = levels.some((l) => l.cover != null);
  return hasAny ? levels : undefined;
}

/**
 * Parse a multi-coordinate Open-Meteo response into the cross-section columns,
 * picking the hour nearest the sun event at each location.
 */
export function parseSunCloudSectionResponse(
  response: OpenMeteoLocation[],
  distancesKm: readonly number[],
  eventType: SunEventType,
  eventTrueMs: number,
  bearingDeg: number,
  altitudeDeg: number,
  origin: LatLng,
): CloudSection {
  const columns: CloudSectionColumn[] = response.map((location, idx) => {
    const distanceKm = distancesKm[idx] ?? 0;
    const i = nearestHourIndex(location, eventTrueMs);
    const hourly = location.hourly ?? {};
    const cloudByLevel = i >= 0 ? buildCloudByLevel(hourly, i) : undefined;
    return {
      lat: location.latitude,
      lon: location.longitude,
      distanceKm,
      cloudByLevel,
      cloudLow: i >= 0 ? numberAt(hourly, 'cloud_cover_low', i) : null,
      cloudMid: i >= 0 ? numberAt(hourly, 'cloud_cover_mid', i) : null,
      cloudHigh: i >= 0 ? numberAt(hourly, 'cloud_cover_high', i) : null,
    };
  });

  return {
    origin,
    eventType,
    eventTrueMs,
    bearingDeg,
    altitudeDeg,
    columns,
  };
}

/**
 * Fetch and parse the cross-section. Returns null on failure (mirrors api.ts's
 * .catch(() => null) resilience).
 */
export async function fetchSunCloudSection(
  origin: WeatherPoint,
  direction: SunDirectionInfo,
): Promise<CloudSection | null> {
  if (origin.latitude == null || origin.longitude == null) return null;
  const dateStr = origin.time.slice(0, 10);
  const url = buildSunCloudSectionUrl(
    { lat: origin.latitude, lon: origin.longitude },
    direction.bearingDeg,
    SUN_SECTION_DISTANCES_KM,
    dateStr,
  );
  try {
    const data = await cachedFetch<OpenMeteoLocation[]>(url, TTL_WEATHER);
    if (!Array.isArray(data) || data.length === 0) return null;
    return parseSunCloudSectionResponse(
      data,
      SUN_SECTION_DISTANCES_KM,
      direction.eventType,
      direction.eventTrueMs,
      direction.bearingDeg,
      direction.altitudeDeg,
      { lat: origin.latitude, lon: origin.longitude },
    );
  } catch {
    return null;
  }
}

/** Fallback altitude (m) for a pressure level when geopotential height is missing. */
function altitudeForPressure(pressure: number, altitude: number | null): number | null {
  return altitude ?? APPROX_PRESSURE_HEIGHTS[pressure] ?? null;
}

/** Re-exported for the drawer's geometry helpers. */
export function altitudeForPressureExport(
  pressure: number,
  altitude: number | null,
): number | null {
  return altitudeForPressure(pressure, altitude);
}

export { HOUR_MS };
