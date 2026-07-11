import { describe, expect, it } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { MoonEventList, WeatherPoint, WeatherTimeline } from '../types/weather';
import {
  captureFileName,
  captureLocationLabel,
  captureRangeLabel,
  captureSelectionFromCurrentDay,
  captureSelectionFromViewport,
  includeRequiredCaptureRange,
  normalizeCaptureSelection,
  sliceTimelineForCapture,
  updateCaptureSelectionByDrag,
} from './timelineCapture';

function makePoint(index: number, overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  const hour = index % 24;
  return makeWeatherPoint({
    cityName: index < 3 ? 'City A' : 'City B',
    time: `2026-03-27T${hour.toString().padStart(2, '0')}:00:00`,
    hour,
    ...overrides,
  });
}

function makeTimeline(length: number): WeatherTimeline {
  return makeWeatherTimeline(Array.from({ length }, (_, index) => makePoint(index)));
}

describe('timeline capture selection', () => {
  it('keeps a required expanded range whole when the selection intersects it', () => {
    expect(
      includeRequiredCaptureRange(
        { startIndex: 4, endIndex: 7 },
        { startIndex: 6, endIndex: 8 },
        12,
      ),
    ).toEqual({ startIndex: 4, endIndex: 8 });
    expect(
      includeRequiredCaptureRange(
        { startIndex: 7, endIndex: 9 },
        { startIndex: 6, endIndex: 8 },
        12,
      ),
    ).toEqual({ startIndex: 6, endIndex: 9 });
    expect(
      includeRequiredCaptureRange(
        { startIndex: 0, endIndex: 4 },
        { startIndex: 6, endIndex: 8 },
        12,
      ),
    ).toEqual({ startIndex: 0, endIndex: 4 });
  });

  it('normalizes selections to integer hourly bounds', () => {
    expect(normalizeCaptureSelection({ startIndex: 2.4, endIndex: 7.6 }, 10)).toEqual({
      startIndex: 2,
      endIndex: 8,
    });
    expect(normalizeCaptureSelection({ startIndex: -5, endIndex: 0 }, 10)).toEqual({
      startIndex: 0,
      endIndex: 1,
    });
    expect(normalizeCaptureSelection({ startIndex: 99, endIndex: 120 }, 10)).toEqual({
      startIndex: 9,
      endIndex: 10,
    });
  });

  it('creates the default selection from the visible viewport', () => {
    expect(captureSelectionFromViewport(45, 110, 10)).toEqual({
      startIndex: 2,
      endIndex: 8,
    });
  });

  it('creates the default selection from the current visible day block', () => {
    const timeline = makeWeatherTimeline([
      makePoint(0, { cityName: 'City A', time: '2026-03-26T22:00:00', hour: 22 }),
      makePoint(1, { cityName: 'City A', time: '2026-03-26T23:00:00', hour: 23 }),
      makePoint(2, { cityName: 'City A', time: '2026-03-27T00:00:00', hour: 0 }),
      makePoint(3, { cityName: 'City A', time: '2026-03-27T01:00:00', hour: 1 }),
      makePoint(4, { cityName: 'City A', time: '2026-03-27T02:00:00', hour: 2 }),
      makePoint(5, { cityName: 'City B', time: '2026-03-27T03:00:00', hour: 3 }),
    ]);

    expect(captureSelectionFromCurrentDay(3 * 22, timeline)).toEqual({
      startIndex: 2,
      endIndex: 5,
    });
  });

  it('snaps handle and move drags by whole hours', () => {
    const selection = { startIndex: 2, endIndex: 6 };

    expect(updateCaptureSelectionByDrag(selection, 'start', 3, 10)).toEqual({
      startIndex: 5,
      endIndex: 6,
    });
    expect(updateCaptureSelectionByDrag(selection, 'end', -4, 10)).toEqual({
      startIndex: 2,
      endIndex: 3,
    });
    expect(updateCaptureSelectionByDrag(selection, 'move', 8, 10)).toEqual({
      startIndex: 6,
      endIndex: 10,
    });
  });
});

describe('timeline capture slicing', () => {
  it('slices data and remaps overlay coordinates into capture-local space', () => {
    const timeline = makeTimeline(6);
    const moonEvents = [
      {
        type: 'moonrise',
        time: new Date('2026-03-27T04:00:00'),
        localHour: 4,
        localMinute: 0,
        absoluteIndex: 4,
      },
    ] as MoonEventList;
    moonEvents.phase = 0.25;
    moonEvents.fraction = 0.5;

    timeline.sunEvents = [
      {
        type: 'sunrise',
        time: new Date('2026-03-27T03:15:00'),
        localHour: 3,
        localMinute: 15,
        absoluteIndex: 3.25,
      },
      {
        type: 'sunset',
        time: new Date('2026-03-27T05:45:00'),
        localHour: 5,
        localMinute: 45,
        absoluteIndex: 5.75,
      },
    ];
    timeline.moonEvents = moonEvents;
    timeline.nightBands = [
      { left: 0.5, right: 3.5 },
      { left: 4, right: 6 },
    ];

    const sliced = sliceTimelineForCapture(timeline, { startIndex: 2, endIndex: 5 });

    expect(sliced).toHaveLength(3);
    expect(sliced.map((item) => item.hour)).toEqual([2, 3, 4]);
    expect(sliced.sunEvents?.map((event) => event.absoluteIndex)).toEqual([1.25]);
    expect(sliced.moonEvents?.map((event) => event.absoluteIndex)).toEqual([2]);
    expect(sliced.moonEvents?.phase).toBe(0.25);
    expect(sliced.moonEvents?.fraction).toBe(0.5);
    expect(sliced.nightBands).toEqual([
      { left: -0.5, right: 1.5 },
      { left: 2, right: 2.5 },
    ]);
  });

  it('formats capture labels and filenames from the selected range', () => {
    const timeline = makeTimeline(5);
    const sliced = sliceTimelineForCapture(timeline, { startIndex: 1, endIndex: 4 });

    expect(captureLocationLabel(sliced)).toBe('City A -> City B');
    expect(captureRangeLabel(sliced)).toBe('3/27 01:00 - 3/27 03:00');
    expect(captureFileName(timeline, { startIndex: 1, endIndex: 4 })).toBe(
      'weather-20260327-01-20260327-03.webp',
    );
  });
});
