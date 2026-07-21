import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import {
  getExpandedMinutelyWidth,
  getMinutelyExpandedSpanForTimes,
  getMinutelySelectionExpandedSpan,
} from './minutelyExpansion';

const HOUR_MS = 60 * 60 * 1000;

describe('minutely expansion geometry', () => {
  it('uses two columns for a two-hour forecast viewed on the hour', () => {
    const originMs = Date.parse('2026-07-11T14:00:00Z');

    expect(getMinutelyExpandedSpanForTimes(originMs, originMs + 30 * 1000)).toBe(2);
    expect(getExpandedMinutelyWidth(2)).toBe(264);
  });

  it('uses three columns when a two-hour forecast starts after the hour', () => {
    const originMs = Date.parse('2026-07-11T14:00:00Z');

    expect(getMinutelyExpandedSpanForTimes(originMs, originMs + 20 * 60 * 1000)).toBe(3);
    expect(getExpandedMinutelyWidth(3)).toBe(396);
  });

  it('prefers the returned forecast coverage and clamps the span to available data', () => {
    const originMs = Date.parse('2026-07-11T14:00:00Z');
    const selection = {
      index: 1,
      item: makeWeatherPoint({ timeUtcMs: originMs }),
      status: 'success' as const,
      data: {
        updateTime: '2026-07-11T14:20:00Z',
        fxLink: 'https://www.qweather.com',
        summary: '未来两小时有雨',
        points: Array.from({ length: 24 }, (_, index) => ({
          fxTime: new Date(originMs + (index + 1) * 5 * 60 * 1000).toISOString(),
          precip: 0.1,
          type: 'rain' as const,
        })),
      },
      error: null,
    };

    expect(getMinutelySelectionExpandedSpan(selection)).toBe(2);
    expect(getMinutelySelectionExpandedSpan(selection, 2)).toBe(1);
    expect(selection.data.points.at(-1)?.fxTime).toBe(
      new Date(originMs + 2 * HOUR_MS).toISOString(),
    );
  });
});
