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
    const layout = createTimelineLayout(1, 20, 0, 264, 2);
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

    expect(atFirstPoint).toBeCloseTo(258 / 48);
    expect(atThirtyMinutes).toBeCloseTo(258 / 48 + (258 / 24) * 6);
  });
});
