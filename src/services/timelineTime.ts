import type { WeatherPoint } from '../types/weather';

export const HOUR_MS = 60 * 60 * 1000;

export function getWeatherPointTimeMs(item: WeatherPoint): number | null {
  if (item.timeUtcMs != null && Number.isFinite(item.timeUtcMs)) return item.timeUtcMs;
  const parsed = new Date(item.time).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function getWeatherPointIntervalEndMs(item: WeatherPoint, fallbackHours = 1): number | null {
  if (item.intervalEndUtcMs != null && Number.isFinite(item.intervalEndUtcMs)) {
    return item.intervalEndUtcMs;
  }
  const startMs = getWeatherPointTimeMs(item);
  return startMs == null ? null : startMs + fallbackHours * HOUR_MS;
}

export function isFollowingHourlyPoint(
  current: WeatherPoint | undefined,
  next: WeatherPoint | undefined,
): next is WeatherPoint {
  if (!current || !next || next.cityName !== current.cityName) return false;
  const currentMs = getWeatherPointTimeMs(current);
  const nextMs = getWeatherPointTimeMs(next);
  if (currentMs == null || nextMs == null) return false;
  const gapMs = nextMs - currentMs;
  return gapMs > 0 && gapMs <= HOUR_MS * 1.5;
}

/**
 * Returns the source point whose accumulated precipitation belongs in a displayed hour cell.
 * Open-Meteo timestamps precipitation at the end of the preceding hour, while aggregated and
 * synthetic points can already be normalized to their displayed cell.
 */
export function getPrecipitationPointForCell(
  data: readonly WeatherPoint[],
  cellIndex: number,
): WeatherPoint | null {
  const item = data[cellIndex];
  if (!item) return null;
  if (item.precipitationInterval !== 'preceding-hour') return item;

  const next = data[cellIndex + 1];
  return isFollowingHourlyPoint(item, next) && next.precipitationInterval === 'preceding-hour'
    ? next
    : null;
}
