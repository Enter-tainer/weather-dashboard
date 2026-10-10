import { describe, expect, it } from 'vitest';
import {
  CLOUD_AND_RAIN_LANE_HEIGHT,
  CLOUD_PLOT_HEIGHT,
  cloudAltitudeToY,
  PRECIPITATION_PLOT_HEIGHT,
  PRECIPITATION_PLOT_TOP,
} from './cloudAndRainScale';

describe('cloud and rain vertical scale', () => {
  it('keeps the cloud plot above the dedicated precipitation strip', () => {
    expect(CLOUD_AND_RAIN_LANE_HEIGHT).toBe(150);
    expect(CLOUD_PLOT_HEIGHT).toBe(108);
    expect(PRECIPITATION_PLOT_TOP).toBe(110);
    expect(PRECIPITATION_PLOT_HEIGHT).toBe(40);
    expect(CLOUD_PLOT_HEIGHT).toBeLessThan(PRECIPITATION_PLOT_TOP);
  });

  it('maps every cloud altitude into the cloud-only region', () => {
    expect(cloudAltitudeToY(0)).toBe(CLOUD_PLOT_HEIGHT);
    expect(cloudAltitudeToY(2_000)).toBeCloseTo(CLOUD_PLOT_HEIGHT * (1 - 0.333));
    expect(cloudAltitudeToY(6_000)).toBeCloseTo(CLOUD_PLOT_HEIGHT * (1 - 0.667));
    expect(cloudAltitudeToY(10_000)).toBe(0);
  });

  it('honours an explicit plot height for other canvases', () => {
    const height = 260;
    expect(cloudAltitudeToY(0, height)).toBe(height);
    expect(cloudAltitudeToY(2_000, height)).toBeCloseTo(height * (1 - 0.333));
    expect(cloudAltitudeToY(6_000, height)).toBeCloseTo(height * (1 - 0.667));
    expect(cloudAltitudeToY(10_000, height)).toBe(0);
    // Out-of-range altitudes clamp to the axis span, not beyond.
    expect(cloudAltitudeToY(-500, height)).toBe(height);
    expect(cloudAltitudeToY(50_000, height)).toBe(0);
  });

  it('measures altitudes from the ground reference instead of sea level', () => {
    const plateau = 3_603;
    // The terrain itself sits on the axis baseline, and the sky above it uses the full span.
    expect(cloudAltitudeToY(plateau, CLOUD_PLOT_HEIGHT, plateau)).toBe(CLOUD_PLOT_HEIGHT);
    expect(cloudAltitudeToY(plateau + 2_000, CLOUD_PLOT_HEIGHT, plateau)).toBeCloseTo(
      CLOUD_PLOT_HEIGHT * (1 - 0.333),
    );
    expect(cloudAltitudeToY(plateau + 6_000, CLOUD_PLOT_HEIGHT, plateau)).toBeCloseTo(
      CLOUD_PLOT_HEIGHT * (1 - 0.667),
    );
    expect(cloudAltitudeToY(plateau + 10_000, CLOUD_PLOT_HEIGHT, plateau)).toBe(0);
    // Anything below the ground reference collapses onto the baseline.
    expect(cloudAltitudeToY(1_500, CLOUD_PLOT_HEIGHT, plateau)).toBe(CLOUD_PLOT_HEIGHT);
  });
});
