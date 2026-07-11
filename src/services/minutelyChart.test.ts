import { describe, expect, it } from 'vitest';
import {
  createMinutelyChartHorizontalGeometry,
  getHourlyPrecipBarHeight,
  getMinutelyEquivalentHourlyRate,
  getMinutelyPrecipBarHeight,
  getMinutelyTimeTickIndices,
} from './minutelyChart';

describe('minutely precipitation chart', () => {
  it('shares one horizontal geometry between bars and the time axis', () => {
    const geometry = createMinutelyChartHorizontalGeometry(100, 264, 24);

    expect(geometry.plotLeft).toBe(100);
    expect(geometry.plotRight).toBe(358);
    expect(geometry.slotWidth).toBeCloseTo(258 / 24);
    expect(geometry.getPointCenter(0)).toBeCloseTo(100 + 258 / 48);
    expect(geometry.getPointCenter(23)).toBeCloseTo(358 - 258 / 48);
  });

  it('uses the same physical y-scale for hourly and five-minute precipitation', () => {
    expect(getMinutelyEquivalentHourlyRate(0.5)).toBe(6);
    expect(getMinutelyPrecipBarHeight(0.5)).toBe(24);
    expect(getHourlyPrecipBarHeight(6)).toBe(24);
    expect(getMinutelyPrecipBarHeight(1)).toBe(40);
    expect(getHourlyPrecipBarHeight(12)).toBe(40);
  });

  it('aligns time ticks to wall-clock hours and half-hours', () => {
    const points = Array.from({ length: 24 }, (_, index) => {
      const totalMinutes = 16 * 60 + 45 + index * 5;
      const hour = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, '0');
      const minute = (totalMinutes % 60).toString().padStart(2, '0');
      return { fxTime: `2026-07-11T${hour}:${minute}+08:00` };
    });

    expect(getMinutelyTimeTickIndices(points)).toEqual([3, 9, 15, 21]);
    expect(getMinutelyTimeTickIndices([])).toEqual([]);
  });
});
