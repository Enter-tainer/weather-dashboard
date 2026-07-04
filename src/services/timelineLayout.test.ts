import { describe, expect, it } from 'vitest';
import {
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
