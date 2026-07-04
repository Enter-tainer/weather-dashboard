import { describe, expect, it } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import { calculateDashboardScales, getBeaufort } from './weatherMetrics';

describe('getBeaufort', () => {
  it.each([
    [null, 0],
    [Number.NaN, 0],
    [0, 0],
    [1.99, 0],
    [2, 1],
    [5.99, 1],
    [6, 2],
    [11.99, 2],
    [12, 3],
    [19.99, 3],
    [20, 4],
    [28.99, 4],
    [29, 5],
    [38.99, 5],
    [39, 6],
    [49.99, 6],
    [50, 7],
    [61.99, 7],
    [62, 8],
    [74.99, 8],
    [75, 9],
    [88.99, 9],
    [89, 10],
    [102.99, 10],
    [103, 11],
    [117.99, 11],
    [118, 12],
  ])('maps %s km/h to Bft %s', (speed, expected) => {
    expect(getBeaufort(speed)).toBe(expected);
  });
});

describe('calculateDashboardScales', () => {
  it('includes deterministic, ensemble, pressure member, and gust ranges', () => {
    const timeline = makeWeatherTimeline([
      makeWeatherPoint({
        temperature: 5,
        tempEnsemble: { p10: -12, p25: -4, p50: 2, p75: 18, p90: 33 },
        tempMembers: [-18, 40],
        pressure: 1000.4,
        pressureMembers: [990.2, 1030.8],
        windSpeed: 20,
        windGusts: 118,
      }),
      makeWeatherPoint({
        temperature: 12,
        pressure: 1012,
        windSpeed: 6,
        windGusts: 10,
      }),
    ]);

    expect(calculateDashboardScales(timeline)).toEqual({
      minTemp: -23,
      maxTemp: 45,
      minP: 989,
      maxP: 1032,
      maxBft: 12,
      tempSteps: [-40, -20, 0, 20, 40, 60],
    });
  });

  it('keeps a usable wind scale when observed winds are calm', () => {
    const scales = calculateDashboardScales(
      makeWeatherTimeline([
        makeWeatherPoint({ windSpeed: 0, windGusts: 1, temperature: 20, pressure: 1013 }),
      ]),
    );

    expect(scales.maxBft).toBe(4);
  });
});
