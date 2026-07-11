import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQWeatherCredentials,
  loadQWeatherCredentials,
  normalizeQWeatherHost,
  saveQWeatherCredentials,
  validateQWeatherCredentials,
} from './qweatherCredentials';

describe('QWeather BYOK credentials', () => {
  beforeEach(() => clearQWeatherCredentials());

  it('normalizes pasted hosts and defaults to session-only storage', () => {
    expect(normalizeQWeatherHost(' https://abc.qweatherapi.com/ ')).toBe('abc.qweatherapi.com');

    saveQWeatherCredentials(
      { apiKey: ' user-key ', apiHost: 'https://abc.qweatherapi.com/' },
      false,
    );

    expect(loadQWeatherCredentials()).toEqual({
      apiKey: 'user-key',
      apiHost: 'abc.qweatherapi.com',
      persistent: false,
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(1);
  });

  it('moves a remembered credential to localStorage and clears both stores', () => {
    saveQWeatherCredentials({ apiKey: 'remembered-key', apiHost: 'abc.qweatherapi.com' }, true);

    expect(loadQWeatherCredentials()?.persistent).toBe(true);
    expect(window.localStorage.length).toBe(1);
    expect(window.sessionStorage.length).toBe(0);

    clearQWeatherCredentials();
    expect(loadQWeatherCredentials()).toBeNull();
  });

  it('rejects empty keys and non-QWeather hosts', () => {
    expect(() =>
      validateQWeatherCredentials({ apiKey: '', apiHost: 'abc.qweatherapi.com' }),
    ).toThrow('API Key');
    expect(() => validateQWeatherCredentials({ apiKey: 'key', apiHost: 'example.com' })).toThrow(
      'API Host',
    );
  });
});
