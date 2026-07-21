import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import { getMinutelyEligibleIndices } from './useMinutelyPrecipitation';

describe('getMinutelyEligibleIndices', () => {
  it('enables the current hour and the next two hours at the same location', () => {
    const baseMs = Date.parse('2026-07-11T06:00:00Z');
    const data = Array.from({ length: 4 }, (_, index) =>
      makeWeatherPoint({
        cityName: '北京',
        latitude: 39.9,
        longitude: 116.4,
        time: new Date(baseMs + index * 60 * 60 * 1000).toISOString(),
        timeUtcMs: baseMs + index * 60 * 60 * 1000,
        hour: 14 + index,
      }),
    );

    expect([...getMinutelyEligibleIndices(data, baseMs + 20 * 60 * 1000)]).toEqual([0, 1, 2]);
  });

  it('only enables two hours when the forecast starts exactly on the hour', () => {
    const baseMs = Date.parse('2026-07-11T06:00:00Z');
    const data = Array.from({ length: 4 }, (_, index) =>
      makeWeatherPoint({
        cityName: '北京',
        latitude: 39.9,
        longitude: 116.4,
        timeUtcMs: baseMs + index * 60 * 60 * 1000,
      }),
    );

    expect([...getMinutelyEligibleIndices(data, baseMs)]).toEqual([0, 1]);
  });

  it('does not enable minutely data without coordinates or a current timeline hour', () => {
    const nowMs = Date.parse('2026-07-11T06:20:00Z');
    const missingCoordinates = [
      makeWeatherPoint({ timeUtcMs: nowMs - 20 * 60 * 1000 }),
      makeWeatherPoint({ timeUtcMs: nowMs + 40 * 60 * 1000 }),
    ];

    expect(getMinutelyEligibleIndices(missingCoordinates, nowMs).size).toBe(0);
    expect(
      getMinutelyEligibleIndices(
        [makeWeatherPoint({ latitude: 39.9, longitude: 116.4, timeUtcMs: nowMs - 3_600_000 })],
        nowMs + 10 * 3_600_000,
      ).size,
    ).toBe(0);
  });
});
