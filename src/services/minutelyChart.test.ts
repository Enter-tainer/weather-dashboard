import { describe, expect, it } from 'vitest';
import {
  createMinutelyChartHorizontalGeometry,
  formatMinutelyTime,
  getHourlyPrecipBarHeight,
  getMinutelyEquivalentHourlyRate,
  getMinutelyPrecipBarHeight,
  getMinutelyTimeTickIndices,
  PRECIP_AXIS_TICKS_MM_HOUR,
  PRECIP_INTENSITY_BANDS,
} from './minutelyChart';

describe('minutely precipitation chart', () => {
  it('aligns bars and the now-indicator to wall-clock time within the region', () => {
    const originMs = Date.parse('2026-07-11T15:00:00Z');
    const firstPointMs = Date.parse('2026-07-11T15:05:00Z');
    const stepMs = 5 * 60 * 1000;
    const spanMs = 3 * 60 * 60 * 1000;
    const geometry = createMinutelyChartHorizontalGeometry(100, 396, 24, {
      originMs,
      spanMs,
      firstPointMs,
      stepMs,
    });

    expect(geometry.plotLeft).toBe(100);
    expect(geometry.plotRight).toBe(496);
    // One 5-min slot = 5/180 of the 396px region.
    expect(geometry.slotWidth).toBeCloseTo((5 / 180) * 396);
    // The exact forecast timestamp is a slot boundary.
    expect(geometry.getPointStart(0)).toBeCloseTo(100 + (5 / 180) * 396);
    // Bar 0 centres the slot starting at 15:05, i.e. 15:07.5 → (7.5/180)*396 from plotLeft.
    expect(geometry.getPointCenter(0)).toBeCloseTo(100 + (7.5 / 180) * 396);
    // Bar 23 centres the slot starting at 17:00, i.e. 17:02.5 → (122.5/180)*396 from plotLeft.
    expect(geometry.getPointCenter(23)).toBeCloseTo(100 + (122.5 / 180) * 396);

    // now-line follows the same wall-clock scale and matches hourly cell boundaries.
    expect(geometry.getXForTime(originMs)).toBe(100); // region start
    expect(geometry.getXForTime(originMs + 90 * 60 * 1000)).toBeCloseTo(100 + (90 / 180) * 396); // mid
    expect(geometry.getXForTime(originMs + 3 * 60 * 60 * 1000)).toBe(496); // region end
    expect(geometry.getXForTime(originMs - 60 * 60 * 1000)).toBe(100); // clamped before region
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

  it('formats forecast timestamps in the selected location timezone', () => {
    expect(formatMinutelyTime('2026-07-11T17:30+08:00', 'Asia/Taipei')).toBe('17:30');
    expect(formatMinutelyTime('2026-07-11T09:30:00Z', 'Asia/Taipei')).toBe('17:30');
    expect(formatMinutelyTime('2026-07-11T09:30:00Z', undefined, 8 * 60 * 60)).toBe('17:30');
  });

  it('defines short-duration rain intensity guides on the shared y-scale', () => {
    expect(PRECIP_AXIS_TICKS_MM_HOUR).toEqual([0, 1, 5, 10]);
    expect(PRECIP_INTENSITY_BANDS).toEqual([
      { label: '小雨', minRate: 0, maxRate: 1 },
      { label: '中雨', minRate: 1, maxRate: 5 },
      { label: '大雨', minRate: 5, maxRate: 10 },
    ]);
  });
});
