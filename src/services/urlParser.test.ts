import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from './geocoding';
import {
  buildRouteForSelections,
  generate7Days,
  parseRoute,
  parseSwitchableRoute,
  stringifyRoute,
} from './urlParser';

vi.mock('./geocoding', () => ({
  reverseGeocode: vi.fn(),
}));

const mockReverseGeocode = vi.mocked(reverseGeocode);

function setUrl(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

function setGeolocation(value: Geolocation | undefined): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value,
  });
}

describe('urlParser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T12:00:00Z'));
    vi.clearAllMocks();
    setUrl('');
    setGeolocation(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    setGeolocation(undefined);
  });

  it('parses city entries, aliases, and coordinate entries with reverse-geocoded names', async () => {
    mockReverseGeocode.mockResolvedValue('Tokyo');
    setUrl('?route=Beijing~北京:2026-05-23;35.68,139.69:2026-05-24');

    await expect(parseRoute()).resolves.toEqual([
      {
        city: 'Beijing',
        originalName: '北京',
        date: '2026-05-23',
      },
      {
        lat: 35.68,
        lon: 139.69,
        originalName: 'Tokyo',
        date: '2026-05-24',
      },
    ]);

    expect(mockReverseGeocode).toHaveBeenCalledWith(35.68, 139.69, '35.68°, 139.69°');
  });

  it('groups same-date route entries into switchable date slots', async () => {
    setUrl('?route=Beijing~北京:2026-05-23;Shanghai~上海:2026-05-23;London:2026-05-24');

    await expect(parseSwitchableRoute()).resolves.toEqual({
      dateSlots: [
        {
          date: '2026-05-23',
          activeIndex: 0,
          entries: [
            { city: 'Beijing', originalName: '北京', date: '2026-05-23' },
            { city: 'Shanghai', originalName: '上海', date: '2026-05-23' },
          ],
        },
        {
          date: '2026-05-24',
          activeIndex: 0,
          entries: [{ city: 'London', originalName: 'London', date: '2026-05-24' }],
        },
      ],
    });
  });

  it('returns null for non-switchable routes', async () => {
    setUrl('?route=Beijing:2026-05-23;Shanghai:2026-05-24');

    await expect(parseSwitchableRoute()).resolves.toBeNull();
  });

  it('uses browser geolocation when no route param is present', async () => {
    mockReverseGeocode.mockResolvedValue('Local City');
    setGeolocation({
      getCurrentPosition: (success) => {
        success({
          coords: {
            latitude: 31.23,
            longitude: 121.47,
          } as GeolocationCoordinates,
        } as GeolocationPosition);
      },
    } as Geolocation);

    const entries = await parseRoute();

    expect(entries).toHaveLength(7);
    expect(entries[0]).toEqual({
      lat: 31.23,
      lon: 121.47,
      originalName: 'Local City',
      date: '2026-05-23',
    });
    expect(entries[6]?.date).toBe('2026-05-29');
    expect(mockReverseGeocode).toHaveBeenCalledWith(31.23, 121.47);
  });

  it('falls back to Beijing when geolocation is unavailable', async () => {
    const entries = await parseRoute();

    expect(entries).toHaveLength(7);
    expect(entries[0]).toEqual({
      city: 'Beijing',
      originalName: '北京',
      date: '2026-05-23',
    });
    expect(entries[6]?.date).toBe('2026-05-29');
  });

  it('builds selected entries and stringifies routes consistently', () => {
    const entries = buildRouteForSelections([
      {
        date: '2026-05-23',
        activeIndex: 1,
        entries: [
          { city: 'Beijing', originalName: '北京', date: '2026-05-23' },
          { lat: 35.68, lon: 139.69, originalName: '东京', date: '2026-05-23' },
        ],
      },
    ]);

    expect(entries).toEqual([
      { lat: 35.68, lon: 139.69, originalName: '东京', date: '2026-05-23' },
    ]);
    expect(stringifyRoute(entries)).toBe('35.68,139.69~东京:2026-05-23');
    expect(generate7Days('Paris', null, 'Paris')[0]).toEqual({
      city: 'Paris',
      originalName: 'Paris',
      date: '2026-05-23',
    });
  });
});
