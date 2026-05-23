import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCityDataForDate, assembleTimeline } from '../services/api';
import { buildRouteForSelections, parseRoute, parseSwitchableRoute } from '../services/urlParser';
import { useDashboardData } from './useDashboardData';

vi.mock('../services/api', () => ({
  fetchCityDataForDate: vi.fn(),
  assembleTimeline: vi.fn(results => results.flat()),
}));

vi.mock('../services/urlParser', () => ({
  parseRoute: vi.fn(),
  parseSwitchableRoute: vi.fn(),
  buildRouteForSelections: vi.fn(slots => slots.map(slot => ({
    ...slot.entries[slot.activeIndex],
    date: slot.date,
  }))),
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function DashboardDataProbe({ testData }) {
  const {
    data,
    loadingDone,
    switching,
    switchInfo,
    handleCityClick,
  } = useDashboardData(testData);

  return (
    <div>
      <output aria-label="data">{(data ?? []).map(item => item.id).join(',')}</output>
      <output aria-label="loading-done">{String(loadingDone)}</output>
      <output aria-label="switching">{String(switching)}</output>
      <output aria-label="switch-info">{Object.keys(switchInfo).join(',')}</output>
      <button type="button" onClick={() => handleCityClick('City A')}>switch city</button>
    </div>
  );
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseSwitchableRoute.mockResolvedValue(null);
    parseRoute.mockResolvedValue([]);
    buildRouteForSelections.mockImplementation(slots => slots.map(slot => ({
      ...slot.entries[slot.activeIndex],
      date: slot.date,
    })));
    assembleTimeline.mockImplementation(results => results.flat());
    fetchCityDataForDate.mockResolvedValue([]);
  });

  it('uses supplied testData without fetching routes', () => {
    render(<DashboardDataProbe testData={[{ id: 'mock-hour' }]} />);

    expect(screen.getByLabelText('data')).toHaveTextContent('mock-hour');
    expect(screen.getByLabelText('loading-done')).toHaveTextContent('true');
    expect(parseSwitchableRoute).not.toHaveBeenCalled();
    expect(parseRoute).not.toHaveBeenCalled();
    expect(fetchCityDataForDate).not.toHaveBeenCalled();
  });

  it('streams partial route data before marking loading complete', async () => {
    const first = deferred();
    const second = deferred();

    parseRoute.mockResolvedValue([{ city: 'first' }, { city: 'second' }]);
    fetchCityDataForDate.mockImplementation(entry => (
      entry.city === 'first' ? first.promise : second.promise
    ));

    render(<DashboardDataProbe />);

    await waitFor(() => expect(fetchCityDataForDate).toHaveBeenCalledTimes(2));

    second.resolve([{ id: 'second-hour' }]);

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('second-hour');
      expect(screen.getByLabelText('loading-done')).toHaveTextContent('false');
    });

    first.resolve([{ id: 'first-hour' }]);

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('first-hour,second-hour');
      expect(screen.getByLabelText('loading-done')).toHaveTextContent('true');
    });
  });

  it('builds switch info for switchable routes and preloads inactive entries', async () => {
    const dateSlots = [
      {
        date: '2026-05-23',
        activeIndex: 0,
        entries: [
          { city: 'a', originalName: 'City A' },
          { city: 'b', originalName: 'City B' },
        ],
      },
    ];

    parseSwitchableRoute.mockResolvedValue({ dateSlots });
    fetchCityDataForDate.mockImplementation(entry => Promise.resolve([
      { id: `${entry.originalName}-hour` },
    ]));

    render(<DashboardDataProbe />);

    await waitFor(() => {
      expect(screen.getByLabelText('data')).toHaveTextContent('City A-hour');
      expect(screen.getByLabelText('loading-done')).toHaveTextContent('true');
      expect(screen.getByLabelText('switch-info')).toHaveTextContent('City A');
    });

    expect(buildRouteForSelections).toHaveBeenCalledWith(dateSlots);
    expect(fetchCityDataForDate).toHaveBeenCalledWith({
      city: 'b',
      originalName: 'City B',
      date: '2026-05-23',
    });
  });

  it('switches to the next city option for a switchable date slot', async () => {
    const dateSlots = [
      {
        date: '2026-05-23',
        activeIndex: 0,
        entries: [
          { city: 'a', originalName: 'City A' },
          { city: 'b', originalName: 'City B' },
        ],
      },
    ];

    parseSwitchableRoute.mockResolvedValue({ dateSlots });
    fetchCityDataForDate.mockImplementation(entry => Promise.resolve([
      { id: `${entry.originalName}-hour` },
    ]));

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

    expect(buildRouteForSelections).toHaveBeenLastCalledWith([
      {
        date: '2026-05-23',
        activeIndex: 1,
        entries: dateSlots[0].entries,
      },
    ]);
  });
});
