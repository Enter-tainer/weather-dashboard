import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import type { SunEvent, WeatherTimeline } from '../types/weather';
import { useSunViewSelection } from './useSunViewSelection';

const ORIGIN_TIME = '2026-07-15T19:00';

const DATA: WeatherTimeline = [
  makeWeatherPoint({ time: '2026-07-15T17:00', cityName: 'Beijing', hour: 17 }),
  makeWeatherPoint({ time: '2026-07-15T18:00', cityName: 'Beijing', hour: 18 }),
  makeWeatherPoint({
    time: ORIGIN_TIME,
    cityName: 'Beijing',
    hour: 19,
    latitude: 39.9,
    longitude: 116.4,
  }),
];

const SUN_EVENTS: SunEvent[] = [
  {
    type: 'sunrise',
    time: new Date('2026-07-15T05:00Z'),
    localHour: 5,
    localMinute: 0,
    absoluteIndex: 5,
  },
  {
    type: 'sunset',
    time: new Date('2026-07-15T12:00Z'),
    localHour: 19,
    localMinute: 44,
    absoluteIndex: 2.7,
  },
];
DATA.sunEvents = SUN_EVENTS;

function SunViewProbe() {
  const { activeSunEvent, originItem, selectSunEvent, closeSunView } = useSunViewSelection(DATA);

  return (
    <div>
      <output aria-label="active-type">{activeSunEvent?.type ?? ''}</output>
      <output aria-label="origin-time">{originItem?.time ?? ''}</output>
      <button type="button" onClick={() => selectSunEvent(SUN_EVENTS[1]!)}>
        select sunset
      </button>
      <button type="button" onClick={closeSunView}>
        close
      </button>
    </div>
  );
}

describe('useSunViewSelection', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('hydrates the sunset event from the ?sunview= URL param', () => {
    // The event belongs to the timeline cell whose left boundary is the origin time.
    window.history.replaceState({}, '', `/?sunview=${encodeURIComponent(`${ORIGIN_TIME}|sunset`)}`);

    render(<SunViewProbe />);

    expect(screen.getByLabelText('active-type')).toHaveTextContent('sunset');
    expect(screen.getByLabelText('origin-time')).toHaveTextContent(ORIGIN_TIME);
  });

  it('selects a sun event and writes originTime|type to the URL', () => {
    render(<SunViewProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'select sunset' }));

    expect(screen.getByLabelText('active-type')).toHaveTextContent('sunset');
    expect(screen.getByLabelText('origin-time')).toHaveTextContent(ORIGIN_TIME);
    expect(window.location.search).toBe(`?sunview=${encodeURIComponent(`${ORIGIN_TIME}|sunset`)}`);
  });

  it('clears the URL param on close', () => {
    window.history.replaceState({}, '', `/?sunview=${encodeURIComponent(`${ORIGIN_TIME}|sunset`)}`);
    render(<SunViewProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(screen.getByLabelText('active-type')).toHaveTextContent('');
    expect(window.location.search).toBe('');
  });

  it('ignores a malformed sunview param', () => {
    window.history.replaceState({}, '', '/?sunview=garbage');
    render(<SunViewProbe />);
    expect(screen.getByLabelText('active-type')).toHaveTextContent('');
  });

  it('ignores a sunview param whose origin time is not in the data', () => {
    window.history.replaceState({}, '', '/?sunview=2099-01-01T00:00|sunset');
    render(<SunViewProbe />);
    expect(screen.getByLabelText('active-type')).toHaveTextContent('');
  });
});
