import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import {
  getIndicatorPosition,
  getMinutelyIndicatorPosition,
} from '../services/currentTimePosition';
import { createTimelineLayout } from '../services/timelineLayout';

describe('CurrentTimeIndicator geometry', () => {
  it('maps elapsed time from the left edge of an expanded hour', () => {
    const startMs = Date.parse('2026-07-11T15:00:00Z');
    const data = [
      makeWeatherPoint({ timeUtcMs: startMs }),
      makeWeatherPoint({ timeUtcMs: startMs + 60 * 60 * 1000 }),
    ];
    const layout = createTimelineLayout(2, 20, 0, 200, 2);

    expect(getIndicatorPosition(data, startMs, layout)).toBe(0);
    expect(getIndicatorPosition(data, startMs + 15 * 60 * 1000, layout)).toBe(25);
    expect(getIndicatorPosition(data, startMs + 30 * 60 * 1000, layout)).toBe(50);
    expect(getIndicatorPosition(data, startMs + 60 * 60 * 1000, layout)).toBe(100);
  });

  it('uses the minute forecast geometry while the detail range is expanded', () => {
    const startMs = Date.parse('2026-07-11T15:05:00Z');
    const item = makeWeatherPoint({ timeUtcMs: startMs - 5 * 60 * 1000 });
    // 3 source hours expanded into a 396px region; each cell is 132px.
    const layout = createTimelineLayout(3, 20, 0, 396, 3);
    const selection = {
      index: 0,
      item,
      status: 'success' as const,
      data: {
        updateTime: '2026-07-11T15:05:00Z',
        fxLink: 'https://www.qweather.com',
        summary: '未来两小时有雨',
        points: Array.from({ length: 24 }, (_, index) => ({
          fxTime: new Date(startMs + index * 5 * 60 * 1000).toISOString(),
          precip: 0.1,
          type: 'rain' as const,
        })),
      },
      error: null,
    };

    const atFirstPoint = getMinutelyIndicatorPosition(selection, startMs, layout);
    const atThirtyMinutes = getMinutelyIndicatorPosition(
      selection,
      startMs + 30 * 60 * 1000,
      layout,
    );

    // now is anchored to the hour start (15:00); 5min in = 1/36 of the 396px region.
    expect(atFirstPoint).toBeCloseTo((5 / 180) * 396);
    // 35min after the hour start = 7/36 of the region.
    expect(atThirtyMinutes).toBeCloseTo((35 / 180) * 396);
    // The minutely now-line matches the hourly now-line at the same instant.
    expect(atThirtyMinutes).toBeCloseTo(
      getIndicatorPosition(
        [
          makeWeatherPoint({ timeUtcMs: startMs - 5 * 60 * 1000 }),
          makeWeatherPoint({ timeUtcMs: startMs + 55 * 60 * 1000 }),
          makeWeatherPoint({ timeUtcMs: startMs + 115 * 60 * 1000 }),
        ],
        startMs + 30 * 60 * 1000,
        layout,
      ) ?? -1,
    );
  });

  it('uses an aggregated interval end instead of assuming a one-hour final cell', () => {
    const startMs = Date.parse('2026-07-11T12:00:00Z');
    const data = [
      makeWeatherPoint({
        timeUtcMs: startMs,
        intervalEndUtcMs: startMs + 6 * 60 * 60 * 1000,
      }),
    ];
    const layout = createTimelineLayout(1, 60);

    expect(getIndicatorPosition(data, startMs + 3 * 60 * 60 * 1000, layout)).toBe(30);
  });
});
