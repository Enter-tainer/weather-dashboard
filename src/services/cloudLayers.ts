import type { CloudLevel, NullableNumber, WeatherPoint, WeatherTimeline } from '../types/weather';

/** Covers below this are treated as "no cloud" (matches the lane's historical threshold). */
const MIN_BAND_COVER = 3;

/**
 * Altitudes (m ASL) of the pressure levels the app requests, used when the response has no
 * geopotential height. Levels at or above the plot top (250/200 hPa) are deliberately absent:
 * they only ever clamp to the top edge of the axis.
 */
export const CLOUD_PRESSURE_FALLBACK_ALTITUDE: Readonly<Record<number, number>> = {
  1000: 110,
  975: 320,
  950: 500,
  925: 800,
  900: 1000,
  850: 1500,
  800: 1900,
  700: 3000,
  600: 4200,
  500: 5600,
  400: 7200,
  300: 9200,
};

/**
 * Vertical extent of the model's low/mid/high cloud classes, measured above the ground.
 * Open-Meteo documents them as low (up to 3 km), mid (3–8 km) and high (from 8 km), and reports
 * them against the terrain — on a plateau they are three to four kilometres above the 3 km ASL
 * a sea-level reading would put them at.
 */
const CLASSIFIED_CLOUD_BANDS = [
  { baseOffset: 0, topOffset: 3_000, key: 'low' },
  { baseOffset: 3_000, topOffset: 8_000, key: 'mid' },
  { baseOffset: 8_000, topOffset: 10_000, key: 'high' },
] as const;

/** One drawable cloud layer, in meters above sea level. */
export interface CloudBand {
  baseAltitude: number;
  topAltitude: number;
  cover: number;
}

/** Altitude (m ASL) of a pressure level: measured geopotential height, else the standard profile. */
export function pressureLevelAltitude(
  pressure: number,
  altitude: number | null | undefined,
): number | null {
  return altitude ?? CLOUD_PRESSURE_FALLBACK_ALTITUDE[pressure] ?? null;
}

/**
 * Ground reference of the cloud axis for a timeline: the lowest terrain in it, so no column is
 * drawn below the axis. Sea level (0) when the data carries no elevation at all.
 */
export function getCloudGroundAltitude(data: WeatherTimeline | null | undefined): number {
  let ground: number | null = null;
  if (!data) return 0;
  for (const item of data) {
    const elevation = item.elevation;
    if (elevation == null || !Number.isFinite(elevation)) continue;
    ground = ground == null ? elevation : Math.min(ground, elevation);
  }
  return ground ?? 0;
}

/** Cloud layers from the model's ground-relative low/mid/high classes, in meters ASL. */
export function classifiedCloudBands(
  low: NullableNumber | undefined,
  mid: NullableNumber | undefined,
  high: NullableNumber | undefined,
  ground: number,
): CloudBand[] {
  const covers = [low, mid, high];
  const bands: CloudBand[] = [];
  CLASSIFIED_CLOUD_BANDS.forEach((band, index) => {
    const cover = covers[index];
    if (cover == null || cover < MIN_BAND_COVER) return;
    bands.push({
      baseAltitude: ground + band.baseOffset,
      topAltitude: ground + band.topOffset,
      cover,
    });
  });
  return bands;
}

/**
 * Bands between adjacent pressure levels, in meters ASL. Levels below the terrain are dropped
 * instead of drawn: over high ground the model still reports cover there (mirrored surface
 * humidity fed through the relative-humidity cloud approximation), which used to paint cloud
 * several kilometres under the plateau. A band that straddles the terrain is cut off at the ground
 * and keeps only the cover of the levels above it.
 */
export function pressureLevelCloudBands(
  levels: CloudLevel[] | undefined,
  ground: number,
): CloudBand[] {
  if (!levels) return [];

  const bands: CloudBand[] = [];
  for (let index = 0; index < levels.length - 1; index++) {
    const lower = levels[index];
    const upper = levels[index + 1];
    if (!lower || !upper) continue;

    const altLow = pressureLevelAltitude(lower.pressure, lower.altitude);
    const altHigh = pressureLevelAltitude(upper.pressure, upper.altitude);
    if (altLow == null || altHigh == null) continue;

    const lowerCover = altLow > ground ? lower.cover : null;
    const upperCover = altHigh > ground ? upper.cover : null;
    if (lowerCover == null && upperCover == null) continue;

    const cover = Math.max(lowerCover ?? 0, upperCover ?? 0);
    if (cover < MIN_BAND_COVER) continue;

    const baseAltitude = Math.max(altLow, ground);
    if (altHigh <= baseAltitude) continue;

    bands.push({ baseAltitude, topAltitude: altHigh, cover });
  }
  return bands;
}

/**
 * Cloud layers to draw for one hour, in meters above sea level.
 *
 * The per-pressure-level cover is the model's relative-humidity cloud approximation, and over high
 * terrain the only levels it fills are the ones below the ground. When that leaves nothing above
 * the terrain, fall back to the model's own low/mid/high classes, which are reported against the
 * ground and stay usable at any elevation.
 */
export function cloudBandsForPoint(item: WeatherPoint | null | undefined): CloudBand[] {
  if (!item) return [];
  const ground = item.elevation ?? 0;
  const levelBands = pressureLevelCloudBands(item.cloudByLevel, ground);
  if (levelBands.length > 0) return levelBands;
  return classifiedCloudBands(item.cloudLow, item.cloudMid, item.cloudHigh, ground);
}
