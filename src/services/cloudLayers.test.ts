import { describe, expect, it } from 'vitest';
import { cloudBandsForPoint, getCloudGroundAltitude, pressureLevelAltitude } from './cloudLayers';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { CloudLevel } from '../types/weather';

/** Pressure levels the app requests, with the geopotential heights a 3.6 km plateau reports. */
const PLATEAU_LEVELS: CloudLevel[] = [
  { pressure: 1000, cover: 5, altitude: 173 },
  { pressure: 925, cover: 24, altitude: 833 },
  { pressure: 850, cover: 34, altitude: 1543 },
  { pressure: 700, cover: 42, altitude: 3153 },
  { pressure: 600, cover: 0, altitude: 4411 },
  { pressure: 500, cover: 0, altitude: 5848 },
  { pressure: 400, cover: 0, altitude: 7543 },
];

describe('getCloudGroundAltitude', () => {
  it('returns the lowest terrain in the timeline', () => {
    const timeline = makeWeatherTimeline([
      makeWeatherPoint({ elevation: 3603 }),
      makeWeatherPoint({ elevation: 618 }),
      makeWeatherPoint({ elevation: null }),
    ]);

    expect(getCloudGroundAltitude(timeline)).toBe(618);
  });

  it('falls back to sea level without elevation data', () => {
    expect(getCloudGroundAltitude(makeWeatherTimeline([makeWeatherPoint()]))).toBe(0);
    expect(getCloudGroundAltitude([])).toBe(0);
    expect(getCloudGroundAltitude(null)).toBe(0);
  });
});

describe('pressureLevelAltitude', () => {
  it('prefers the measured geopotential height and falls back to the standard profile', () => {
    expect(pressureLevelAltitude(600, 4411)).toBe(4411);
    expect(pressureLevelAltitude(600, null)).toBe(4200);
    expect(pressureLevelAltitude(250, null)).toBeNull();
  });
});

describe('cloudBandsForPoint', () => {
  it('drops pressure levels below the terrain', () => {
    const bands = cloudBandsForPoint(
      makeWeatherPoint({ elevation: 3603, cloudByLevel: PLATEAU_LEVELS }),
    );

    // 1000–700 hPa are under the 3603 m ground; only the terrain and sky above it may hold cloud.
    for (const band of bands) {
      expect(band.baseAltitude).toBeGreaterThanOrEqual(3603);
    }
    expect(bands).toHaveLength(0);
  });

  it('cuts a band that straddles the terrain at the ground', () => {
    const bands = cloudBandsForPoint(
      makeWeatherPoint({
        elevation: 3603,
        cloudByLevel: [
          { pressure: 700, cover: 40, altitude: 3153 },
          { pressure: 600, cover: 40, altitude: 4411 },
        ],
      }),
    );

    expect(bands).toEqual([{ baseAltitude: 3603, topAltitude: 4411, cover: 40 }]);
  });

  it('keeps pressure-level bands above ground instead of falling back', () => {
    const bands = cloudBandsForPoint(
      makeWeatherPoint({
        elevation: 3,
        cloudByLevel: [
          { pressure: 850, cover: 0, altitude: 1545 },
          { pressure: 800, cover: 44, altitude: 2047 },
          { pressure: 700, cover: 0, altitude: 3151 },
        ],
      }),
    );

    expect(bands).toEqual([
      { baseAltitude: 1545, topAltitude: 2047, cover: 44 },
      { baseAltitude: 2047, topAltitude: 3151, cover: 44 },
    ]);
  });

  it('falls back to the ground-relative low/mid/high classes when no level has cover', () => {
    const bands = cloudBandsForPoint(
      makeWeatherPoint({
        elevation: 3603,
        cloudCover: 100,
        cloudLow: 100,
        cloudMid: 0,
        cloudHigh: 0,
        cloudByLevel: PLATEAU_LEVELS,
      }),
    );

    expect(bands).toEqual([{ baseAltitude: 3603, topAltitude: 6603, cover: 100 }]);
  });

  it('uses the terrain-relative classes at every elevation', () => {
    const bands = cloudBandsForPoint(
      makeWeatherPoint({
        elevation: 5380,
        cloudLow: 40,
        cloudMid: 50,
        cloudHigh: 60,
      }),
    );

    expect(bands).toEqual([
      { baseAltitude: 5380, topAltitude: 8380, cover: 40 },
      { baseAltitude: 8380, topAltitude: 13380, cover: 50 },
      { baseAltitude: 13380, topAltitude: 15380, cover: 60 },
    ]);
  });

  it('ignores covers below the drawing threshold', () => {
    expect(
      cloudBandsForPoint(makeWeatherPoint({ elevation: 3603, cloudLow: 2, cloudMid: 1 })),
    ).toEqual([]);
  });

  it('returns nothing for missing data', () => {
    expect(cloudBandsForPoint(null)).toEqual([]);
  });
});
