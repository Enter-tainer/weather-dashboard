import { describe, expect, it } from 'vitest';
import {
  createTimelineLayout,
  DEFAULT_HOUR_WIDTH,
  getHourCenter,
  getHourLeft,
  getTimelineHourWidth,
  getTimelineWidth,
} from './timelineLayout';

describe('timeline layout helpers', () => {
  it('uses the shared default hour width', () => {
    expect(getTimelineHourWidth()).toBe(DEFAULT_HOUR_WIDTH);
    expect(getTimelineWidth(3)).toBe(DEFAULT_HOUR_WIDTH * 3);
  });

  it('clamps negative timeline lengths to zero', () => {
    expect(getTimelineWidth(-4)).toBe(0);
  });

  it('computes left and center positions from an explicit hour width', () => {
    expect(getHourLeft(5, 12)).toBe(60);
    expect(getHourCenter(5, 12)).toBe(66);
  });
});

describe('createTimelineLayout', () => {
  it('widens the selected column and shifts every later column', () => {
    const layout = createTimelineLayout(4, 20, 1, 100);

    expect(layout.totalWidth).toBe(160);
    expect([0, 1, 2, 3].map(layout.getColumnWidth)).toEqual([20, 100, 20, 20]);
    expect([0, 1, 2, 3].map(layout.getColumnLeft)).toEqual([0, 20, 120, 140]);
    expect([0, 1, 2, 3].map(layout.getColumnCenter)).toEqual([10, 70, 130, 150]);
  });

  it('maps ranges and fractional positions through the expanded geometry', () => {
    const layout = createTimelineLayout(4, 20, 1, 100);

    expect(layout.getRangeWidth(1, 3)).toBe(120);
    expect(layout.getPoint(1)).toBe(70);
    expect(layout.getPoint(1.5)).toBe(120);
    expect(layout.getPoint(2)).toBe(130);
    expect(layout.getPoint(-0.5)).toBe(0);
    expect(layout.getPoint(3.5)).toBe(160);
    expect(layout.getColumnIndexAt(19)).toBe(0);
    expect(layout.getColumnIndexAt(20)).toBe(1);
    expect(layout.getColumnIndexAt(119)).toBe(1);
    expect(layout.getColumnIndexAt(120)).toBe(2);
  });

  it('expands two adjacent source hours into one compact detail region', () => {
    const layout = createTimelineLayout(4, 20, 1, 120, 2);

    expect(layout.totalWidth).toBe(160);
    expect(layout.expandedSpan).toBe(2);
    expect([0, 1, 2, 3].map(layout.getColumnWidth)).toEqual([20, 60, 60, 20]);
    expect([0, 1, 2, 3].map(layout.getColumnLeft)).toEqual([0, 20, 80, 140]);
    expect(layout.getRangeWidth(1, 3)).toBe(120);
    expect([0.5, 1, 1.5, 2, 2.5].map(layout.getPoint)).toEqual([20, 50, 80, 110, 140]);
  });
});
