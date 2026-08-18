import * as SunCalc from 'suncalc';
import type { SunEventType, WeatherPoint } from '../types/weather';

const HOUR_MS = 60 * 60 * 1000;

/** Half-window (ms) around a sun event within which the sun is "near the horizon". */
export const SUN_DRAG_WINDOW_MS = 2 * HOUR_MS;

export interface SunDirectionInfo {
  eventType: SunEventType;
  /** True UTC ms of the sunrise/sunset instant. */
  eventTrueMs: number;
  /** Compass bearing from north (0-360) toward the sun at the instant. */
  bearingDeg: number;
  /** Sun altitude in degrees at the instant (≈ -0.8°, refraction-corrected horizon). */
  altitudeDeg: number;
}

/**
 * A Date representing local noon (true UTC) for the origin's day.
 *
 * The timeline's `SunEvent.time` is `fromUtc`-shifted (not a true instant unless the
 * browser happens to be in the target timezone), and the fixture path stores ISO `Z`
 * strings — so we must NOT recover the instant from `ev.time`. Instead we rebuild a
 * local-noon Date from the origin's true-UTC fields: local midnight (true UTC) + 12h.
 */
export function localNoonDateFromOrigin(origin: WeatherPoint): Date | null {
  if (
    origin.timeUtcMs == null ||
    !Number.isFinite(origin.timeUtcMs) ||
    origin.hour == null ||
    !Number.isFinite(origin.hour)
  ) {
    return null;
  }
  const localMidnightTrueUtcMs = origin.timeUtcMs - origin.hour * HOUR_MS;
  return new Date(localMidnightTrueUtcMs + 12 * HOUR_MS);
}

/**
 * Compute the sun's bearing (compass) and altitude at the sunrise/sunset instant for
 * the origin location on its day. Returns null if the location/time is missing.
 */
export function computeSunDirection(
  origin: WeatherPoint,
  eventType: SunEventType,
): SunDirectionInfo | null {
  const lat = origin.latitude;
  const lon = origin.longitude;
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const dateObj = localNoonDateFromOrigin(origin);
  if (!dateObj) return null;

  const times = SunCalc.getTimes(dateObj, lat, lon);
  const instant = eventType === 'sunrise' ? times.sunrise : times.sunset;
  if (!instant || !Number.isFinite(instant.getTime())) return null;

  const pos = SunCalc.getPosition(instant, lat, lon);
  // SunCalc v2 azimuth: degrees clockwise from north (0 = N, 90 = E, 180 = S).
  const bearingDeg = pos.azimuth;
  const altitudeDeg = pos.altitude; // v2: apparent altitude in degrees

  return {
    eventType,
    eventTrueMs: instant.getTime(),
    bearingDeg,
    altitudeDeg,
  };
}

/**
 * Sun altitude (degrees) at a given true-UTC instant for the origin. Returns null when the
 * location or time is missing. Used by the drawer to map a draggable time to a sun altitude.
 */
export function computeSunAltitudeAt(origin: WeatherPoint, trueMs: number): number | null {
  const lat = origin.latitude;
  const lon = origin.longitude;
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (!Number.isFinite(trueMs)) return null;
  const pos = SunCalc.getPosition(new Date(trueMs), lat, lon);
  return pos.altitude; // v2: apparent altitude in degrees
}

/**
 * Inverse: approximate the true-UTC instant near a sun event whose altitude is closest to a
 * target altitude. The sun's altitude is monotonic over the ±window around sunrise/sunset, so a
 * coarse linear search (sub-minute) resolves a unique instant. Returns null if unresolvable.
 *
 * This lets the drawer start from a sun altitude (e.g. dragged to "0°") and recover a clock time
 * to display. `trueMsHint` is the event instant (or the previously-selected time) the search is
 * anchored to.
 */
export function findTimeForAltitude(
  origin: WeatherPoint,
  targetAltDeg: number,
  trueMsHint: number,
): number | null {
  const lat = origin.latitude;
  const lon = origin.longitude;
  if (lat == null || lon == null || !Number.isFinite(trueMsHint)) return null;
  const stepMs = 60_000; // 1 minute resolution
  let bestMs = trueMsHint;
  let bestDelta = Infinity;
  for (let t = trueMsHint - SUN_DRAG_WINDOW_MS; t <= trueMsHint + SUN_DRAG_WINDOW_MS; t += stepMs) {
    const alt = computeSunAltitudeAt(origin, t);
    if (alt == null) continue;
    const delta = Math.abs(alt - targetAltDeg);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestMs = t;
    }
  }
  return bestMs;
}

/** Clamp a draggable time to the ±SUN_DRAG_WINDOW_MS band around the sun event. */
export function clampToEventWindow(trueMs: number, eventTrueMs: number): number {
  return Math.min(
    Math.max(trueMs, eventTrueMs - SUN_DRAG_WINDOW_MS),
    eventTrueMs + SUN_DRAG_WINDOW_MS,
  );
}
