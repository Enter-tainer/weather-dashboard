import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCityDataForDate, assembleTimeline } from '../services/api';
import { buildRouteForSelections, parseRoute, parseSwitchableRoute } from '../services/urlParser';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { DateSlot, RouteEntry, WeatherTimeline } from '../types/weather';
import { useDashboardData } from './useDashboardData';

vi.mock('../services/api', () => ({
  fetchCityDataForDate: vi.fn(),
  assembleTimeline: vi.fn((results: WeatherTimeline[]): WeatherTimeline => {
    const timeline: WeatherTimeline = [];
    for (const result of results) timeline.push(...result);
    return timeline;
  }),
}));

vi.mock('../services/urlParser', () => ({
  parseRoute: vi.fn(),
  parseSwitchableRoute: vi.fn(),
  buildRouteForSelections: vi.fn((slots: DateSlot[]): RouteEntry[] => slots.map(slot => {
    const activeEntry = slot.entries[slot.activeIndex];
    if (!activeEntry) {
      throw new Error(`Missing active entry for ${slot.date}`);
    }

    return {
      ...activeEntry,
      date: slot.date,
    };
  })),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolveFn: Deferred<T>['resolve'] | undefined;
  let rejectFn: Deferred<T>['reject'] | undefined;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });

  if (!resolveFn || !rejectFn) {
    throw new Error('Failed to create deferred promise');
  }

  return { promise, resolve: resolveFn, reject: rejectFn };
}

interface DashboardDataProbeProps {
  testData?: WeatherTimeline;
}

const mockFetchCityDataForDate = vi.mocked(fetchCityDataForDate);
const mockAssembleTimeline = vi.mocked(assembleTimeline);
const mockBuildRouteForSelections = vi.mocked(buildRouteForSelections);
const mockParseRoute = vi.mocked(parseRoute);
const mockParseSwitchableRoute = vi.mocked(parseSwitchableRoute);

function DashboardDataProbe({ testData }: DashboardDataProbeProps) {
  const {
    data,
    loadingDone,
    switching,
    switchInfo,
    handleCityClick,
  } = useDashboardData(testData);

  return (
    <div>
      <output aria-label="data">{(data ?? []).map(item => item.cityName).join(',')}</output>
      <output aria-label="loading-done">{String(loadingDone)}</output>
      <output aria-label="switching">{String(switching)}</output>
      <output aria-label="switch-info">{Object.keys(switchInfo).join(',')}</output>
      <button type="button" onClick={() => handleCityClick('City A')}>switch city</button>
    </div>
  );
}

function createDateSlot(): DateSlot {
  return {
    date: '2026-05-23',
    activeIndex: 0,
    entries: [
      { city: 'a', originalName: 'City A', date: '2026-05-23' },
      { city: 'b', originalName: 'City B', date: '2026-05-23' },
    ],
  };
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseSwitchableRoute.mockResolvedValue(null);
    mockParseRoute.mockResolvedValue([]);
    mockBuildRouteForSelections.mockImplementation((slots: DateSlot[]): RouteEntry[] => slots.map(slot => {
      const activeEntry = slot.entries[slot.activeIndex];
      if (!activeEntry) {
        throw new Error(`Missing active entry for ${slot.date}`);
      }

      return {
        ...activeEntry,
        date: slot.date,
      };
    }));
    mockAssembleTimeline.mockImplementation((results: WeatherTimeline[]): WeatherTimeline => {
      const timeline: WeatherTimeline = [];
      for (const result of results) timeline.push(...result);
      return timeline;
    });
    mockFetchCityDataForDate.mockResolvedValue(makeWeatherTimeline());
  });

  it('uses supplied testData without fetching routes', () => {
    const testData = makeWeatherTimeline([
      makeWeatherPoint({ cityName: 'mock-hour' }),
    ]);

    render(<DashboardDataProbe testData={testData} />);

    expect(screen.getByLabelText('data')).toHaveTextContent('mock-hour');
    expect(screen.getByLabelText('loading-done')).toHaveTextContent('true');
    expect(mockParseSwitchableRoute).not.toHaveBeenCalled();
    expect(mockParseRoute).not.toHaveBeenCalled();
    expect(mockFetchCityDataForDate).not.toHaveBeenCalled();
  });

  it('streams partial route data before marking loading complete', async () => {
    const first = deferred<WeatherTimeline>();
    const second = deferred<WeatherTimeline>();

    mockParseRoute.mockResolvedValue([
      { city: 'first', date: '2026-05-23' },
      { city: 'second', date: '2026-05-24' },
    ]);
    mockFetchCityDataForDate.mockImplementation(entry => (
      entry.city === 'first' ? first.promise : second.promise
    ));

    render(<DashboardDataProbe />);

    await waitFor(() => expect(mockFetchCityDataForDate).toHaveBeenCalledTimes(2));

    second.resolve(makeWeatherTimeline([
      makeWeatherPoint({ cityName: 'second-hour' }),
    ]));

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('second-hour');
      expect(screen.getByLabelText('loading-done')).toHaveTextContent('false');
    });

    first.resolve(makeWeatherTimeline([
      makeWeatherPoint({ cityName: 'first-hour' }),
    ]));

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('first-hour,second-hour');
      expect(screen.getByLabelText('loading-done')).toHaveTextContent('true');
    });
  });

  it('builds switch info for switchable routes and preloads inactive entries', async () => {
    const dateSlot = createDateSlot();
    const dateSlots = [dateSlot];

    mockParseSwitchableRoute.mockResolvedValue({ dateSlots });
    mockFetchCityDataForDate.mockImplementation(entry => Promise.resolve(makeWeatherTimeline([
      makeWeatherPoint({ cityName: `${entry.originalName ?? entry.city ?? 'unknown'}-hour` }),
    ])));

    render(<DashboardDataProbe />);

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('City A-hour');
      expect(screen.getByLabelText('loading-done')).toHaveTextContent('true');
      expect(screen.getByLabelText('switch-info')).toHaveTextContent('City A');
    });

    expect(mockBuildRouteForSelections).toHaveBeenCalledWith(dateSlots);
    expect(mockFetchCityDataForDate).toHaveBeenCalledWith({
      city: 'b',
      originalName: 'City B',
      date: '2026-05-23',
    });
  });

  it('switches to the next city option for a switchable date slot', async () => {
    const dateSlot = createDateSlot();
    const dateSlots = [dateSlot];

    mockParseSwitchableRoute.mockResolvedValue({ dateSlots });
    mockFetchCityDataForDate.mockImplementation(entry => Promise.resolve(makeWeatherTimeline([
      makeWeatherPoint({ cityName: `${entry.originalName ?? entry.city ?? 'unknown'}-hour` }),
    ])));

    render(<DashboardDataProbe />);

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('City A-hour');
    });

    fireEvent.click(screen.getByRole('button', { name: 'switch city' }));

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('City B-hour');
      expect(screen.getByLabelText('switching')).toHaveTextContent('false');
      expect(screen.getByLabelText('switch-info')).toHaveTextContent('City B');
    });

    expect(mockBuildRouteForSelections).toHaveBeenLastCalledWith([
      {
        date: '2026-05-23',
        activeIndex: 1,
        entries: dateSlot.entries,
      },
    ]);
  });
});
