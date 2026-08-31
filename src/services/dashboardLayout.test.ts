import { describe, expect, it } from 'vitest';
import {
  dashboardLayoutCssVariables,
  getDashboardLayoutMetrics,
  getDashboardStackHeight,
  getVisibleTimelineHours,
} from './dashboardLayout';

describe('dashboardLayout', () => {
  it('keeps the standard lane stack unchanged', () => {
    const metrics = getDashboardLayoutMetrics('standard', 'landscape');

    expect(metrics.hourWidth).toBe(22);
    expect(metrics.legendWidth).toBe(48);
    expect(getDashboardStackHeight(metrics)).toBe(679);
  });

  it('targets roughly one day in portrait reader mode', () => {
    const metrics = getDashboardLayoutMetrics('reader', 'portrait');

    expect(metrics.hourWidth).toBe(36);
    expect(metrics.legendWidth).toBe(80);
    expect(getDashboardStackHeight(metrics)).toBe(1044);
    expect(getVisibleTimelineHours(936, metrics)).toBeCloseTo(23.78, 2);
  });

  it('keeps reader typography while tightening chart heights in landscape', () => {
    const metrics = getDashboardLayoutMetrics('reader', 'landscape');

    expect(metrics.hourWidth).toBe(36);
    expect(getDashboardStackHeight(metrics)).toBe(807);
    expect(getVisibleTimelineHours(1248, metrics)).toBeCloseTo(32.44, 2);
    expect(metrics.canvasLabelFontSize).toBeGreaterThan(8);
  });

  it('exports the same geometry as CSS variables', () => {
    const metrics = getDashboardLayoutMetrics('reader', 'portrait');

    expect(dashboardLayoutCssVariables(metrics)).toMatchObject({
      '--col-width-hour': '36px',
      '--legend-width': '80px',
      '--lane-height-location': '34px',
      '--lane-height-clouds': '245px',
      '--lane-height-wind': '120px',
    });
  });
});
