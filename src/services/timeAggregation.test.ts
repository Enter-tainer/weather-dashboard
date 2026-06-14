import { describe, expect, it } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { WeatherPoint } from '../types/weather';
import { aggregateTimelineByHours } from './timeAggregation';

function makePoint(index: number, overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  const hour = index % 24;
  return makeWeatherPoint({
    cityName: 'City A',
    time: `2026-03-27T${hour.toString().padStart(2, '0')}:00:00`,
    hour,
    temperature: 10 + index,
    precipitation: index + 1,
    precipitationProb: index * 10,
    uvIndex: index,
    windGusts: 20 + index,
    weatherCode: index === 1 ? 61 : 0,
    ...overrides,
  });
}

describe('time aggregation', () => {
  it('aggregates weather windows without crossing city boundaries', () => {
    const timeline = makeWeatherTimeline([
      makePoint(0),
      makePoint(1),
      makePoint(2, { cityName: 'City B' }),
      makePoint(3, { cityName: 'City B' }),
      makePoint(4, { cityName: 'City B' }),
    ]);

    const aggregated = aggregateTimelineByHours(timeline, 3);

    expect(aggregated).toHaveLength(2);
    expect(aggregated.map((item) => item.cityName)).toEqual(['City A', 'City B']);
    expect(aggregated[0]?.temperature).toBe(10.5);
    expect(aggregated[0]?.precipitation).toBe(3);
    expect(aggregated[0]?.precipitationProb).toBe(10);
    expect(aggregated[0]?.uvIndex).toBe(1);
    expect(aggregated[0]?.windGusts).toBe(21);
    expect(aggregated[0]?.weatherCode).toBe(61);
    expect(aggregated[1]?.temperature).toBe(13);
    expect(aggregated[1]?.precipitation).toBe(12);
  });

  it('does not aggregate across local day boundaries', () => {
    const timeline = makeWeatherTimeline([
      makePoint(22, { time: '2026-03-27T22:00:00', hour: 22 }),
      makePoint(23, { time: '2026-03-27T23:00:00', hour: 23 }),
      makePoint(0, { time: '2026-03-28T00:00:00', hour: 0 }),
      makePoint(1, { time: '2026-03-28T01:00:00', hour: 1 }),
      makePoint(2, { time: '2026-03-28T02:00:00', hour: 2 }),
    ]);

    const aggregated = aggregateTimelineByHours(timeline, 6);

    expect(aggregated).toHaveLength(2);
    expect(aggregated.map((item) => item.hour)).toEqual([22, 0]);
    expect(aggregated[0]?.precipitation).toBe(47);
    expect(aggregated[1]?.precipitation).toBe(6);
  });

  it('aligns six-hour aggregation into four columns for a full day', () => {
    const timeline = makeWeatherTimeline(Array.from({ length: 24 }, (_, index) => makePoint(index)));

    const aggregated = aggregateTimelineByHours(timeline, 6);

    expect(aggregated).toHaveLength(4);
    expect(aggregated.map((item) => item.hour)).toEqual([0, 6, 12, 18]);
  });

  it('remaps sun events and night bands into aggregated column space', () => {
    const timeline = makeWeatherTimeline([
      makePoint(0),
      makePoint(1),
      makePoint(2),
      makePoint(3),
      makePoint(4),
      makePoint(5),
    ]);
    timeline.sunEvents = [
      {
        type: 'sunrise',
        time: new Date('2026-03-27T03:30:00'),
        localHour: 3,
        localMinute: 30,
        absoluteIndex: 3.5,
      },
    ];
    timeline.nightBands = [{ left: 1.5, right: 4.5 }];

    const aggregated = aggregateTimelineByHours(timeline, 3);

    expect(aggregated.sunEvents?.[0]?.absoluteIndex).toBeCloseTo(1 + 0.5 / 3);
    expect(aggregated.nightBands?.[0]?.left).toBeCloseTo(0.5);
    expect(aggregated.nightBands?.[0]?.right).toBeCloseTo(1.5);
  });
});
