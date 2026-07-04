import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import type { SoundingLevel } from '../types/weather';
import {
  buildSurfaceSoundingPoint,
  detectInversions,
  dewPointFromRh,
  toSkewtFormat,
  withSurfaceLevel,
} from './sounding';

describe('dewPointFromRh', () => {
  it('returns null when temperature or humidity is unavailable', () => {
    expect(dewPointFromRh(null, 80)).toBeNull();
    expect(dewPointFromRh(20, null)).toBeNull();
    expect(dewPointFromRh(20, 0)).toBeNull();
  });

  it('clamps relative humidity before computing dew point', () => {
    expect(dewPointFromRh(20, 100)).toBeCloseTo(20, 6);
    expect(dewPointFromRh(20, 150)).toBeCloseTo(20, 6);
    expect(dewPointFromRh(20, 50)).toBeCloseTo(9.26, 2);
  });
});

describe('surface sounding helpers', () => {
  it('builds a surface level from available point data', () => {
    expect(
      buildSurfaceSoundingPoint(
        makeWeatherPoint({
          temperature: 21,
          pressure: 1008,
          dewPoint: 12,
          humidity: 58,
          windSpeed: 18,
          windDir: 270,
        }),
      ),
    ).toEqual({
      pressure: 1008,
      temp: 21,
      dewPoint: 12,
      relativeHumidity: 58,
      altitude: null,
      agl: 2,
      windSpeed: 18,
      windDir: 270,
      surface: true,
    });
  });

  it('does not create a surface level without temperature or pressure', () => {
    expect(buildSurfaceSoundingPoint(makeWeatherPoint({ temperature: null }))).toBeNull();
    expect(buildSurfaceSoundingPoint(makeWeatherPoint({ pressure: null }))).toBeNull();
  });

  it('prepends the surface level before pressure levels', () => {
    const pressureLevel: SoundingLevel = {
      pressure: 900,
      temp: 14,
      dewPoint: 9,
      relativeHumidity: 72,
      altitude: 1000,
      agl: 998,
      windSpeed: 20,
      windDir: 250,
    };

    const levels = withSurfaceLevel(
      makeWeatherPoint({
        temperature: 18,
        pressure: 1010,
        soundingLevels: [pressureLevel],
      }),
    );

    expect(levels).toHaveLength(2);
    expect(levels[0]?.surface).toBe(true);
    expect(levels[1]).toBe(pressureLevel);
  });
});

describe('toSkewtFormat', () => {
  it('filters incomplete levels and converts wind speed to meters per second', () => {
    const levels: SoundingLevel[] = [
      {
        pressure: 900,
        temp: 12,
        dewPoint: 8,
        relativeHumidity: 70,
        altitude: null,
        agl: null,
        windSpeed: 36,
        windDir: 270,
      },
      {
        pressure: 850,
        temp: null,
        dewPoint: 5,
        relativeHumidity: 70,
        altitude: null,
        agl: 1500,
        windSpeed: 36,
        windDir: 270,
      },
    ];

    expect(toSkewtFormat(levels)).toEqual([
      {
        press: 900,
        hght: 1000,
        temp: 12,
        dwpt: 8,
        wdir: 270,
        wspd: 10,
      },
    ]);
  });
});

describe('detectInversions', () => {
  it('detects and merges adjacent warming layers by height', () => {
    const item = makeWeatherPoint({
      temperature: 10,
      pressure: 1010,
      soundingLevels: [
        {
          pressure: 900,
          temp: 12,
          dewPoint: 8,
          relativeHumidity: 70,
          altitude: null,
          agl: 1000,
          windSpeed: 10,
          windDir: 180,
        },
        {
          pressure: 850,
          temp: 15,
          dewPoint: 6,
          relativeHumidity: 60,
          altitude: null,
          agl: 1500,
          windSpeed: 20,
          windDir: 190,
        },
        {
          pressure: 800,
          temp: 13,
          dewPoint: 3,
          relativeHumidity: 50,
          altitude: null,
          agl: 1900,
          windSpeed: 30,
          windDir: 200,
        },
      ],
    });

    expect(detectInversions(item)).toEqual([
      {
        baseM: 2,
        topM: 1500,
        strengthC: 5,
        gradientCPer100m: 5 / ((1500 - 2) / 100),
      },
    ]);
  });
});
