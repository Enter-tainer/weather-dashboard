import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import { fetchMinutelyPrecipitation } from '../services/qweather';
import { getMinutelyEligibleIndices, useMinutelyPrecipitation } from './useMinutelyPrecipitation';

vi.mock('../services/qweather', () => ({
  fetchMinutelyPrecipitation: vi.fn(),
}));

const fetchMinutelyMock = vi.mocked(fetchMinutelyPrecipitation);

function makeHourlyData(baseMs: number, cityName = '北京') {
  return Array.from({ length: 4 }, (_, index) =>
    makeWeatherPoint({
      cityName,
      latitude: 39.9,
      longitude: 116.4,
      time: new Date(baseMs + index * 60 * 60 * 1000).toISOString(),
      timeUtcMs: baseMs + index * 60 * 60 * 1000,
      hour: 14 + index,
    }),
  );
}

beforeEach(() => {
  fetchMinutelyMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getMinutelyEligibleIndices', () => {
  it('enables the current hour and the next two hours at the same location', () => {
    const baseMs = Date.parse('2026-07-11T06:00:00Z');
    const data = makeHourlyData(baseMs);

    expect([...getMinutelyEligibleIndices(data, baseMs + 20 * 60 * 1000)]).toEqual([0, 1, 2]);
  });

  it('only enables two hours when the forecast starts exactly on the hour', () => {
    const baseMs = Date.parse('2026-07-11T06:00:00Z');
    const data = Array.from({ length: 4 }, (_, index) =>
      makeWeatherPoint({
        cityName: '北京',
        latitude: 39.9,
        longitude: 116.4,
        timeUtcMs: baseMs + index * 60 * 60 * 1000,
      }),
    );

    expect([...getMinutelyEligibleIndices(data, baseMs)]).toEqual([0, 1]);
  });

  it('does not enable minutely data without coordinates or a current timeline hour', () => {
    const nowMs = Date.parse('2026-07-11T06:20:00Z');
    const missingCoordinates = [
      makeWeatherPoint({ timeUtcMs: nowMs - 20 * 60 * 1000 }),
      makeWeatherPoint({ timeUtcMs: nowMs + 40 * 60 * 1000 }),
    ];

    expect(getMinutelyEligibleIndices(missingCoordinates, nowMs).size).toBe(0);
    expect(
      getMinutelyEligibleIndices(
        [makeWeatherPoint({ latitude: 39.9, longitude: 116.4, timeUtcMs: nowMs - 3_600_000 })],
        nowMs + 10 * 3_600_000,
      ).size,
    ).toBe(0);
  });
});

describe('useMinutelyPrecipitation', () => {
  it('keeps an open panel anchored when streamed timeline data shifts its index', async () => {
    const baseMs = Date.parse('2026-07-11T06:00:00Z');
    vi.setSystemTime(baseMs + 20 * 60 * 1000);
    let resolveRequest!: (value: {
      updateTime: string;
      fxLink: string;
      summary: string;
      points: never[];
    }) => void;
    fetchMinutelyMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const initialData = makeHourlyData(baseMs);
    const { result, rerender } = renderHook(({ data }) => useMinutelyPrecipitation(data), {
      initialProps: { data: initialData },
    });

    act(() => result.current.select(0));
    expect(result.current.selection?.index).toBe(0);

    const precedingPoint = makeWeatherPoint({
      cityName: '上海',
      latitude: 31.2,
      longitude: 121.5,
      time: new Date(baseMs - 24 * 60 * 60 * 1000).toISOString(),
      timeUtcMs: baseMs - 24 * 60 * 60 * 1000,
    });
    rerender({ data: [precedingPoint, ...initialData] });

    await waitFor(() => expect(result.current.selection?.index).toBe(1));

    await act(async () => {
      resolveRequest({
        updateTime: new Date(baseMs).toISOString(),
        fxLink: '',
        summary: '两小时内无降水',
        points: [],
      });
      await Promise.resolve();
    });

    expect(result.current.selection).toMatchObject({ index: 1, status: 'success' });
  });

  it('does not collapse an open panel when the current hour advances', () => {
    vi.useFakeTimers();
    const baseMs = Date.parse('2026-07-11T06:00:00Z');
    vi.setSystemTime(baseMs + 59 * 60 * 1000 + 30 * 1000);
    fetchMinutelyMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMinutelyPrecipitation(makeHourlyData(baseMs)));
    act(() => result.current.select(0));
    expect(result.current.selection?.index).toBe(0);

    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(result.current.availableIndices.has(0)).toBe(false);
    expect(result.current.selection?.index).toBe(0);
  });
});
