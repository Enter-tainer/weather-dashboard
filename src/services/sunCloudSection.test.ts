import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSunCloudSectionUrl,
  parseSunCloudSectionResponse,
  SUN_SECTION_DISTANCES_KM,
} from './sunCloudSection';
import { makeWeatherPoint } from '../test-utils/weather';
import type { CloudSection, CloudSectionColumn } from './sunCloudSection';

vi.mock('./cache', () => ({
  cachedFetch: vi.fn(),
  TTL_WEATHER: 10 * 60 * 1000,
}));

// Beijing 2026-07-15 sunset is 2026-07-15T11:43:40Z. Local noon true UTC = 04:00Z.
const SUNSET_TRUE_MS = Date.parse('2026-07-15T11:43:40Z');
// Beijing local 19:00 == 11:00Z; the nearest-hour bucket to sunset is the 19:00 local entry.
// Build hourly times in Beijing local strings; the 19:00 entry should be picked.
function beijingHourlyTimes(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) times.push(`2026-07-15T${String(h).padStart(2, '0')}:00`);
  return times;
}

const TIMES = beijingHourlyTimes();
// Index of 19:00 local in TIMES.
const INDEX_19 = 19;

function makeLocation(
  overrides: Partial<{
    latitude: number;
    longitude: number;
    utc_offset_seconds: number;
    hourly: Record<string, unknown>;
  }>,
): {
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  hourly: Record<string, unknown>;
} {
  return {
    latitude: 39.9,
    longitude: 116.4,
    utc_offset_seconds: 28800,
    hourly: { time: TIMES, cloud_cover_low: [], cloud_cover_mid: [], cloud_cover_high: [] },
    ...overrides,
  };
}

describe('buildSunCloudSectionUrl', () => {
  it('emits comma-separated lat/lon for every distance and the slim cloud field set', () => {
    const url = buildSunCloudSectionUrl(
      { lat: 39.9, lon: 116.4 },
      90,
      SUN_SECTION_DISTANCES_KM,
      '2026-07-15',
    );
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);

    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const lats = params.get('latitude')!.split(',');
    const lons = params.get('longitude')!.split(',');
    expect(lats).toHaveLength(SUN_SECTION_DISTANCES_KM.length);
    expect(lons).toHaveLength(SUN_SECTION_DISTANCES_KM.length);
    // First point is the origin.
    expect(lats[0]).toBe('39.9000');
    expect(lons[0]).toBe('116.4000');

    const hourly = params.get('hourly')!.split(',');
    expect(hourly).toContain('cloud_cover_low');
    expect(hourly).toContain('cloud_cover_mid');
    expect(hourly).toContain('cloud_cover_high');
    expect(hourly).toContain('cloud_cover_850hPa');
    expect(hourly).toContain('geopotential_height_850hPa');
    expect(params.get('start_date')).toBe('2026-07-15');
    expect(params.get('end_date')).toBe('2026-07-15');
    expect(params.get('timezone')).toBe('auto');
  });
});

describe('parseSunCloudSectionResponse', () => {
  it('picks the hour nearest the sun event and assembles cloudByLevel', () => {
    const hourly: Record<string, unknown> = {
      time: TIMES,
      cloud_cover_low: new Array(24).fill(10),
      cloud_cover_mid: new Array(24).fill(40),
      cloud_cover_high: new Array(24).fill(0),
      cloud_cover_850hPa: new Array(24).fill(60),
      geopotential_height_850hPa: new Array(24).fill(1500),
      cloud_cover_700hPa: new Array(24).fill(0),
      geopotential_height_700hPa: new Array(24).fill(3000),
      cloud_cover_500hPa: new Array(24).fill(0),
      geopotential_height_500hPa: new Array(24).fill(5600),
    };
    const loc = makeLocation({ hourly });
    const section = parseSunCloudSectionResponse([loc], [0], 'sunset', SUNSET_TRUE_MS, 300, -0.8, {
      lat: 39.9,
      lon: 116.4,
    });
    expect(section.columns).toHaveLength(1);
    const col = section.columns[0]!;
    // Nearest hour to 19:43 local is the 19:00 bucket (index 19).
    expect(col.cloudLow).toBe(10);
    expect(col.cloudMid).toBe(40);
    expect(col.cloudByLevel).toBeDefined();
    const level850 = col.cloudByLevel!.find((l) => l.pressure === 850)!;
    expect(level850.cover).toBe(60);
    expect(level850.altitude).toBe(1500);
  });

  it('drops cloudByLevel to undefined when all per-level covers are null', () => {
    const hourly: Record<string, unknown> = {
      time: TIMES,
      cloud_cover_low: new Array(24).fill(10),
      cloud_cover_mid: new Array(24).fill(0),
      cloud_cover_high: new Array(24).fill(0),
      cloud_cover_850hPa: new Array(24).fill(null as unknown as number),
      geopotential_height_850hPa: new Array(24).fill(1500),
      cloud_cover_700hPa: new Array(24).fill(null as unknown as number),
      geopotential_height_700hPa: new Array(24).fill(3000),
    };
    const loc = makeLocation({ hourly });
    const section = parseSunCloudSectionResponse([loc], [0], 'sunset', SUNSET_TRUE_MS, 300, -0.8, {
      lat: 39.9,
      lon: 116.4,
    });
    expect(section.columns[0]!.cloudByLevel).toBeUndefined();
    expect(section.columns[0]!.cloudLow).toBe(10);
  });
});

describe('fetchSunCloudSection (mocked cachedFetch)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when origin lacks lat/lon', async () => {
    const { fetchSunCloudSection } = await import('./sunCloudSection');
    const origin = makeWeatherPoint({ time: '2026-07-15T00:00' });
    delete origin.latitude;
    delete origin.longitude;
    const result = await fetchSunCloudSection(origin, {
      eventType: 'sunset',
      eventTrueMs: SUNSET_TRUE_MS,
      bearingDeg: 300,
      altitudeDeg: -0.8,
    });
    expect(result).toBeNull();
  });

  it('parses a mocked multi-location response', async () => {
    const { fetchSunCloudSection } = await import('./sunCloudSection');
    const { cachedFetch } = await import('./cache');
    const hourly: Record<string, unknown> = {
      time: TIMES,
      cloud_cover_low: new Array(24).fill(8),
      cloud_cover_mid: new Array(24).fill(0),
      cloud_cover_high: new Array(24).fill(0),
      cloud_cover_850hPa: new Array(24).fill(0),
      geopotential_height_850hPa: new Array(24).fill(1500),
    };
    vi.mocked(cachedFetch).mockResolvedValueOnce([
      makeLocation({ latitude: 39.9, longitude: 116.4, hourly }),
      makeLocation({ latitude: 40.1, longitude: 116.9, hourly }),
    ]);

    const origin = makeWeatherPoint({
      latitude: 39.9,
      longitude: 116.4,
      time: '2026-07-15T00:00',
      hour: 0,
    });
    const result = await fetchSunCloudSection(origin, {
      eventType: 'sunset',
      eventTrueMs: SUNSET_TRUE_MS,
      bearingDeg: 300,
      altitudeDeg: -0.8,
    });
    expect(result).not.toBeNull();
    expect(result!.columns).toHaveLength(2);
    expect(result!.columns[0]!.distanceKm).toBe(0);
    expect(result!.columns[1]!.distanceKm).toBe(20);
    // 19:00 local bucket picked.
    expect(result!.columns[0]!.cloudLow).toBe(8);
  });
});
