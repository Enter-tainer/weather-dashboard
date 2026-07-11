import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMinutelyPrecipitation, QWeatherError } from './qweather';
import { clearQWeatherCredentials, saveQWeatherCredentials } from './qweatherCredentials';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearQWeatherCredentials();
  saveQWeatherCredentials({ apiKey: 'test-api-key', apiHost: 'test-host.qweatherapi.com' }, false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchMinutelyPrecipitation', () => {
  it('normalizes the QWeather string response into numeric precipitation points', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        code: '200',
        updateTime: '2026-07-11T14:00+08:00',
        fxLink: 'https://www.qweather.com/weather/beijing-101010100.html',
        summary: '未来两小时无降水',
        minutely: [
          { fxTime: '2026-07-11T14:05+08:00', precip: '0.00', type: 'rain' },
          { fxTime: '2026-07-11T14:10+08:00', precip: '0.12', type: 'snow' },
          { fxTime: 'invalid', precip: null, type: 'rain' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMinutelyPrecipitation(39.9042, 116.4074);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://test-host.qweatherapi.com/v7/minutely/5m?location=116.41%2C39.90&lang=zh',
    );
    expect(init.headers).toEqual({ 'X-QW-Api-Key': 'test-api-key' });
    expect(result.summary).toBe('未来两小时无降水');
    expect(result.points).toEqual([
      { fxTime: '2026-07-11T14:05+08:00', precip: 0, type: 'rain' },
      { fxTime: '2026-07-11T14:10+08:00', precip: 0.12, type: 'snow' },
    ]);
  });

  it('turns a non-success QWeather code into a user-facing error', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ code: '204' }, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMinutelyPrecipitation(51.5, -0.12)).rejects.toEqual(
      expect.objectContaining({ name: 'QWeatherError', code: '204' }),
    );
    await expect(fetchMinutelyPrecipitation(51.5, -0.12)).rejects.toBeInstanceOf(QWeatherError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses a successful location response for five minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T10:00:00Z'));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          code: '200',
          updateTime: '2026-07-11T18:00+08:00',
          summary: '未来两小时有雨',
          minutely: [{ fxTime: '2026-07-11T18:05+08:00', precip: '0.10', type: 'rain' }],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchMinutelyPrecipitation(28.4676, 119.9229);
    await fetchMinutelyPrecipitation(28.4676, 119.9229);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await fetchMinutelyPrecipitation(28.4676, 119.9229);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains how to configure BYOK before making a request', async () => {
    clearQWeatherCredentials();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMinutelyPrecipitation(39.9, 116.4)).rejects.toEqual(
      expect.objectContaining({ code: 'CONFIG' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
