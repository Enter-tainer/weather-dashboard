export const CLOUD_AND_RAIN_LANE_HEIGHT = 150;
export const CLOUD_PLOT_HEIGHT = 108;
export const PRECIPITATION_PLOT_HEIGHT = 40;
export const PRECIPITATION_PLOT_TOP = CLOUD_AND_RAIN_LANE_HEIGHT - PRECIPITATION_PLOT_HEIGHT;

const MAX_CLOUD_ALTITUDE = 10_000;

type AltitudeBreak = readonly [altitude: number, fraction: number];

// Equal vertical space for low (0–2km), mid (2–6km), and high (6–10km) clouds.
const ALTITUDE_BREAKS = [
  [0, 0],
  [2_000, 0.333],
  [6_000, 0.667],
  [10_000, 1],
] as const satisfies readonly AltitudeBreak[];

export function cloudAltitudeToY(altitude: number): number {
  const safeAltitude = Math.min(Math.max(altitude, 0), MAX_CLOUD_ALTITUDE);
  for (let index = 0; index < ALTITUDE_BREAKS.length - 1; index++) {
    const current = ALTITUDE_BREAKS[index];
    const next = ALTITUDE_BREAKS[index + 1];
    if (!current || !next) continue;
    const [startAltitude, startFraction] = current;
    const [endAltitude, endFraction] = next;
    if (safeAltitude <= endAltitude) {
      const fraction =
        startFraction +
        ((endFraction - startFraction) * (safeAltitude - startAltitude)) /
          (endAltitude - startAltitude);
      return CLOUD_PLOT_HEIGHT * (1 - fraction);
    }
  }
  return 0;
}
