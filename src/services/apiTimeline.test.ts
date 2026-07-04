import { describe, expect, it } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { MoonEventList, WeatherTimeline } from '../types/weather';
import { assembleTimeline } from './api';

function makeCityTimeline(cityName: string, hours: string[]): WeatherTimeline {
  return makeWeatherTimeline(
    hours.map((time, index) =>
      makeWeatherPoint({
        cityName,
        time,
        hour: index,
      }),
    ),
  );
}

describe('assembleTimeline', () => {
  it('preserves order and remaps sun, moon, and night metadata into global coordinates', () => {
    const first = makeCityTimeline('City A', [
      '2026-05-23T00:00:00',
      '2026-05-23T01:00:00',
      '2026-05-23T02:00:00',
    ]);
    const second = makeCityTimeline('City B', ['2026-05-24T00:00:00', '2026-05-24T01:00:00']);

    first.sunEvents = [
      {
        type: 'sunrise',
        time: new Date('2026-05-23T01:00:00'),
        localHour: 1,
        localMinute: 0,
      },
      {
        type: 'sunset',
        time: new Date('2026-05-23T02:00:00'),
        localHour: 2,
        localMinute: 0,
      },
    ];
    const moonEvents = [
      {
        type: 'moonrise',
        time: new Date('2026-05-23T01:30:00'),
        localHour: 1,
        localMinute: 30,
      },
    ] as MoonEventList;
    moonEvents.phase = 0.25;
    moonEvents.fraction = 0.5;
    first.moonEvents = moonEvents;

    second.sunEvents = [
      {
        type: 'sunset',
        time: new Date('2026-05-24T01:00:00'),
        localHour: 1,
        localMinute: 0,
      },
    ];

    const assembled = assembleTimeline([first, second]);

    expect(assembled.map((item) => item.cityName)).toEqual([
      'City A',
      'City A',
      'City A',
      'City B',
      'City B',
    ]);
    expect(assembled.sunEvents?.map((event) => [event.type, event.absoluteIndex])).toEqual([
      ['sunrise', 1],
      ['sunset', 2],
      ['sunset', 4],
    ]);
    expect(assembled.nightBands).toEqual([
      { left: -0.5, right: 1 },
      { left: 2, right: 2.5 },
      { left: 4, right: 4.5 },
    ]);
    expect(assembled.moonEvents?.map((event) => [event.type, event.absoluteIndex])).toEqual([
      ['moonrise', 1.5],
    ]);
    expect(assembled.moonEvents?.phase).toBe(0.25);
    expect(assembled.moonEvents?.fraction).toBe(0.5);
  });

  it('skips empty city timelines without shifting later offsets', () => {
    const first = makeCityTimeline('City A', ['2026-05-23T00:00:00']);
    const empty = makeWeatherTimeline();
    const second = makeCityTimeline('City B', ['2026-05-24T00:00:00']);

    second.moonEvents = [
      {
        type: 'moonset',
        time: new Date('2026-05-24T00:30:00'),
        localHour: 0,
        localMinute: 30,
      },
    ] as MoonEventList;

    const assembled = assembleTimeline([first, empty, second]);

    expect(assembled.map((item) => item.cityName)).toEqual(['City A', 'City B']);
    expect(assembled.moonEvents?.[0]?.absoluteIndex).toBe(1.5);
  });
});
