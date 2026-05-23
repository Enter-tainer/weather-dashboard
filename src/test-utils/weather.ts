import type { WeatherPoint, WeatherTimeline } from '../types/weather';

export function makeWeatherPoint(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return {
    cityName: 'Test City',
    time: '2026-05-23T00:00:00Z',
    hour: 0,
    weatherCode: 0,
    temperature: 20,
    humidity: 50,
    dewPoint: 10,
    apparentTemp: 20,
    precipitation: 0,
    precipitationProb: 0,
    windSpeed: 5,
    windGusts: 8,
    windDir: 180,
    visibility: 10_000,
    uvIndex: 0,
    pressure: 1013,
    cape: 0,
    cloudCover: 0,
    cloudLow: 0,
    cloudMid: 0,
    cloudHigh: 0,
    ...overrides,
  };
}

export function makeWeatherTimeline(points: WeatherPoint[] = []): WeatherTimeline {
  const timeline: WeatherTimeline = [...points];
  return timeline;
}
