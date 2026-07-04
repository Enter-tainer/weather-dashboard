import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedFetch } from './cache';
import { getCityDetails } from './geocoding';
import { fetchCityDataForDate } from './api';

vi.mock('./cache', () => ({
  TTL_WEATHER: 1,
  cachedFetch: vi.fn(),
}));

vi.mock('./geocoding', () => ({
  getCityDetails: vi.fn(),
  reverseGeocode: vi.fn(),
}));

const mockCachedFetch = vi.mocked(cachedFetch);
const mockGetCityDetails = vi.mocked(getCityDetails);

function mockForecastFailureEnsembleSuccess(): void {
  mockCachedFetch.mockImplementation((url: string) => {
    if (url.includes('/v1/forecast')) {
      return Promise.reject(new Error('forecast unavailable'));
    }

    if (url.includes('ensemble-api.open-meteo.com')) {
      return Promise.resolve({
        utc_offset_seconds: 0,
        timezone: 'UTC',
        elevation: 50,
        hourly: {
          time: ['2026-08-01T00:00'],
          temperature_2m_member01: [10],
          temperature_2m_member02: [14],
          relative_humidity_2m_member01: [70],
          relative_humidity_2m_member02: [90],
          precipitation_member01: [0],
          precipitation_member02: [0.2],
          precipitation_member03: [0.3],
          wind_speed_10m_member01: [10],
          wind_speed_10m_member02: [20],
          wind_direction_10m_member01: [350],
          wind_direction_10m_member02: [10],
          cloud_cover_member01: [20],
          cloud_cover_member02: [70],
          surface_pressure_member01: [1000],
          surface_pressure_member02: [1004],
          weather_code_member01: [61],
          weather_code_member02: [61],
          weather_code_member03: [0],
        },
      });
    }

    if (url.includes('air-quality-api.open-meteo.com')) {
      return Promise.reject(new Error('aqi unavailable'));
    }

    return Promise.resolve(null);
  });
}

describe('fetchCityDataForDate fallback handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCityDetails.mockResolvedValue({
      latitude: 39.9,
      longitude: 116.4,
      timezone: 'UTC',
      name: 'Test City',
    });
  });

  it('uses ensemble member data without hardcoded weather defaults when forecast fails', async () => {
    mockForecastFailureEnsembleSuccess();

    const timeline = await fetchCityDataForDate({
      city: 'test-city',
      originalName: 'Test City',
      date: '2026-08-01',
    });

    const point = timeline[0];

    expect(point?.dataSource).toBe('ensemble');
    expect(point?.temperature).toBe(12);
    expect(point?.humidity).toBe(80);
    expect(point?.dewPoint).not.toBeNull();
    expect(point?.precipitation).toBeCloseTo(0.166, 2);
    expect(point?.precipitationProb).toBe(67);
    expect(point?.windSpeed).toBe(15);
    expect(point?.windDir).toBeCloseTo(0, 6);
    expect(point?.cloudCover).toBe(45);
    expect(point?.pressure).toBe(1002);
    expect(point?.weatherCode).toBe(61);

    expect(point?.apparentTemp).toBeNull();
    expect(point?.windGusts).toBeNull();
    expect(point?.visibility).toBeNull();
    expect(point?.cloudLow).toBeNull();
    expect(point?.uvIndex).toBeNull();
    expect(point?.cape).toBeNull();
    expect(point?.aqiUS).toBeNull();

    const ensembleUrl = mockCachedFetch.mock.calls
      .map(([url]) => url)
      .find((url) => url.includes('ensemble-api.open-meteo.com'));
    expect(ensembleUrl).toContain('relative_humidity_2m');
    expect(ensembleUrl).toContain('wind_direction_10m');
  });

  it('keeps missing forecast and AQI fields unavailable instead of defaulting them', async () => {
    mockCachedFetch.mockImplementation((url: string) => {
      if (url.includes('/v1/forecast')) {
        return Promise.resolve({
          utc_offset_seconds: 0,
          timezone: 'UTC',
          elevation: 50,
          hourly: {
            time: ['2026-08-02T00:00'],
            temperature_2m: [21],
            relative_humidity_2m: [null],
            weather_code: [null],
            surface_pressure: [null],
          },
        });
      }

      return Promise.reject(new Error('secondary API unavailable'));
    });

    const timeline = await fetchCityDataForDate({
      city: 'test-city',
      originalName: 'Test City Missing Fields',
      date: '2026-08-02',
    });

    const point = timeline[0];

    expect(point?.dataSource).toBe('forecast');
    expect(point?.temperature).toBe(21);
    expect(point?.humidity).toBeNull();
    expect(point?.weatherCode).toBeNull();
    expect(point?.pressure).toBeNull();
    expect(point?.precipitation).toBeNull();
    expect(point?.aqiUS).toBeNull();
    expect(point?.pm25).toBeNull();
  });
});
