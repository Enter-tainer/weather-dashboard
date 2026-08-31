import { describe, expect, it } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { MoonEventList } from '../types/weather';
import { getRollingTimelineStartIndex, sliceRollingTimeline } from './rollingTimeline';

function makeTimeline() {
  const data = makeWeatherTimeline([
    makeWeatherPoint({
      time: '2026-05-23T20:00:00',
      timeUtcMs: Date.parse('2026-05-23T12:00Z'),
      hour: 20,
    }),
    makeWeatherPoint({
      time: '2026-05-23T21:00:00',
      timeUtcMs: Date.parse('2026-05-23T13:00Z'),
      hour: 21,
    }),
    makeWeatherPoint({
      time: '2026-05-23T22:00:00',
      timeUtcMs: Date.parse('2026-05-23T14:00Z'),
      hour: 22,
    }),
    makeWeatherPoint({
      time: '2026-05-23T23:00:00',
      timeUtcMs: Date.parse('2026-05-23T15:00Z'),
      hour: 23,
    }),
  ]);
  data.sunEvents = [
    {
      type: 'sunset',
      time: new Date('2026-05-23T13:30Z'),
      localHour: 21,
      localMinute: 30,
      absoluteIndex: 1.5,
    },
  ];
  data.moonEvents = [
    {
      type: 'moonrise',
      time: new Date('2026-05-23T14:30Z'),
      localHour: 22,
      localMinute: 30,
      absoluteIndex: 2.5,
    },
  ] as MoonEventList;
  data.nightBands = [{ left: 1.5, right: 4 }];
  return data;
}

describe('rollingTimeline', () => {
  it('keeps the current hour and removes completed hours', () => {
    const data = makeTimeline();
    const nowMs = Date.parse('2026-05-23T13:25Z');

    expect(getRollingTimelineStartIndex(data, nowMs)).toBe(1);
    expect(sliceRollingTimeline(data, nowMs).map((item) => item.hour)).toEqual([21, 22, 23]);
  });

  it('remaps astronomy metadata after reclaiming past columns', () => {
    const sliced = sliceRollingTimeline(makeTimeline(), Date.parse('2026-05-23T13:25Z'));

    expect(sliced.sunEvents?.[0]?.absoluteIndex).toBe(0.5);
    expect(sliced.moonEvents?.[0]?.absoluteIndex).toBe(1.5);
    expect(sliced.nightBands).toEqual([{ left: 0.5, right: 3 }]);
  });

  it('returns an empty timeline when every interval has passed', () => {
    expect(sliceRollingTimeline(makeTimeline(), Date.parse('2026-05-24T00:00Z'))).toHaveLength(0);
  });
});
