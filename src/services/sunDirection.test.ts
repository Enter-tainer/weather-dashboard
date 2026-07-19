import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clampToEventWindow,
  computeSunAltitudeAt,
  computeSunDirection,
  findTimeForAltitude,
  localNoonDateFromOrigin,
  SUN_DRAG_WINDOW_MS,
} from './sunDirection';
import { makeWeatherPoint } from '../test-utils/weather';

// Beijing, 2026-07-15 local day. 2026-07-15T00:00 Beijing == 2026-07-14T16:00:00Z.
const BEIJING_2026_07_15_MIDNIGHT_UTC_MS = Date.parse('2026-07-14T16:00:00Z');

function beijingOrigin(overrides = {}) {
  return makeWeatherPoint({
    cityName: 'Beijing',
    latitude: 39.9,
    longitude: 116.4,
    hour: 0,
    timeUtcMs: BEIJING_2026_07_15_MIDNIGHT_UTC_MS,
    time: '2026-07-15T00:00',
    timezone: 'Asia/Shanghai',
    utcOffsetSeconds: 28800,
    ...overrides,
  });
}

describe('localNoonDateFromOrigin', () => {
  it('returns target-local-noon as a true UTC instant (midnight origin + 12h)', () => {
    const date = localNoonDateFromOrigin(beijingOrigin({ hour: 0 }));
    expect(date).not.toBeNull();
    // 2026-07-15T00:00 Beijing + 12h = 2026-07-15T12:00 Beijing = 2026-07-15T04:00:00Z
    expect(date!.getTime()).toBe(Date.parse('2026-07-15T04:00:00Z'));
  });

  it('is independent of the origin hour (always local noon)', () => {
    const at6 = localNoonDateFromOrigin(
      beijingOrigin({ hour: 6, timeUtcMs: BEIJING_2026_07_15_MIDNIGHT_UTC_MS + 6 * 3600_000 }),
    );
    expect(at6!.getTime()).toBe(Date.parse('2026-07-15T04:00:00Z'));
  });

  it('returns null when timeUtcMs is missing', () => {
    expect(localNoonDateFromOrigin(beijingOrigin({ timeUtcMs: undefined }))).toBeNull();
  });
});

describe('computeSunDirection', () => {
  it('computes a sunrise bearing toward the east for Beijing summer', () => {
    const info = computeSunDirection(beijingOrigin(), 'sunrise');
    expect(info).not.toBeNull();
    // Summer sunrise at 39.9°N is ENE, ~60° compass.
    expect(info!.bearingDeg).toBeGreaterThan(54);
    expect(info!.bearingDeg).toBeLessThan(66);
    // Sunrise instant: sun is at/near the refraction-corrected horizon.
    expect(info!.altitudeDeg).toBeGreaterThan(-2);
    expect(info!.altitudeDeg).toBeLessThan(1);
    expect(Number.isFinite(info!.eventTrueMs)).toBe(true);
  });

  it('computes a sunset bearing toward the west for Beijing summer', () => {
    const info = computeSunDirection(beijingOrigin(), 'sunset');
    expect(info).not.toBeNull();
    // Summer sunset at 39.9°N is WNW, ~300° compass.
    expect(info!.bearingDeg).toBeGreaterThan(292);
    expect(info!.bearingDeg).toBeLessThan(306);
    expect(info!.altitudeDeg).toBeGreaterThan(-2);
    expect(info!.altitudeDeg).toBeLessThan(1);
  });

  it('sunset occurs after sunrise on the same day', () => {
    const rise = computeSunDirection(beijingOrigin(), 'sunrise')!;
    const set = computeSunDirection(beijingOrigin(), 'sunset')!;
    expect(set.eventTrueMs).toBeGreaterThan(rise.eventTrueMs);
  });

  it('echoes the event type', () => {
    expect(computeSunDirection(beijingOrigin(), 'sunrise')!.eventType).toBe('sunrise');
    expect(computeSunDirection(beijingOrigin(), 'sunset')!.eventType).toBe('sunset');
  });

  it('returns null when latitude/longitude are missing', () => {
    expect(computeSunDirection(beijingOrigin({ latitude: undefined }), 'sunset')).toBeNull();
    expect(computeSunDirection(beijingOrigin({ longitude: undefined }), 'sunset')).toBeNull();
  });
});

describe('computeSunAltitudeAt', () => {
  it('matches the event altitude at the sunset instant', () => {
    const info = computeSunDirection(beijingOrigin(), 'sunset')!;
    const alt = computeSunAltitudeAt(beijingOrigin(), info.eventTrueMs);
    expect(alt).not.toBeNull();
    expect(alt).toBeCloseTo(info.altitudeDeg, 1);
  });

  it('is higher before sunset and lower after', () => {
    const info = computeSunDirection(beijingOrigin(), 'sunset')!;
    const before = computeSunAltitudeAt(beijingOrigin(), info.eventTrueMs - 3600_000)!;
    const at = computeSunAltitudeAt(beijingOrigin(), info.eventTrueMs)!;
    const after = computeSunAltitudeAt(beijingOrigin(), info.eventTrueMs + 3600_000)!;
    expect(before).toBeGreaterThan(at);
    expect(at).toBeGreaterThan(after);
  });

  it('returns null without coordinates', () => {
    expect(computeSunAltitudeAt(beijingOrigin({ latitude: undefined }), Date.now())).toBeNull();
  });
});

describe('findTimeForAltitude', () => {
  it('recovers a time whose altitude is near the target near the sunset event', () => {
    const info = computeSunDirection(beijingOrigin(), 'sunset')!;
    // Sunset altitude is ~-0.8°; asking for +4° should land before sunset.
    const ms = findTimeForAltitude(beijingOrigin(), 4, info.eventTrueMs);
    expect(ms).not.toBeNull();
    const alt = computeSunAltitudeAt(beijingOrigin(), ms!);
    expect(alt).not.toBeNull();
    expect(Math.abs(alt! - 4)).toBeLessThan(0.5);
    expect(ms!).toBeLessThan(info.eventTrueMs);
  });
});

describe('clampToEventWindow', () => {
  beforeEach(() => {
    // no-op, kept for parity with other suites
  });
  afterEach(() => {
    // no-op
  });
  it('clamps to ±SUN_DRAG_WINDOW_MS', () => {
    const e = 1_000_000;
    expect(clampToEventWindow(e, e)).toBe(e);
    expect(clampToEventWindow(e + SUN_DRAG_WINDOW_MS + 5000, e)).toBe(e + SUN_DRAG_WINDOW_MS);
    expect(clampToEventWindow(e - SUN_DRAG_WINDOW_MS - 5000, e)).toBe(e - SUN_DRAG_WINDOW_MS);
  });
});
