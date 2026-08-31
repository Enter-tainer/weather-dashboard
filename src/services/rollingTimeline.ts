import type { WeatherTimeline } from '../types/weather';
import { sliceTimelineForCapture } from './timelineCapture';
import { getWeatherPointIntervalEndMs, getWeatherPointTimeMs, HOUR_MS } from './timelineTime';

export function getRollingTimelineStartIndex(data: WeatherTimeline, nowMs: number): number {
  for (let index = 0; index < data.length; index += 1) {
    const item = data[index];
    if (!item) continue;
    const startMs = getWeatherPointTimeMs(item);
    const endMs =
      getWeatherPointIntervalEndMs(item) ?? (startMs == null ? null : startMs + HOUR_MS);
    if (endMs != null && endMs > nowMs) return index;
  }
  return data.length;
}

export function sliceRollingTimeline(data: WeatherTimeline, nowMs: number): WeatherTimeline {
  const startIndex = getRollingTimelineStartIndex(data, nowMs);
  if (startIndex <= 0) return data;
  if (startIndex >= data.length) return [];
  return sliceTimelineForCapture(data, { startIndex, endIndex: data.length });
}
