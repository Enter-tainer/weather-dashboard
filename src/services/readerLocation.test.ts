import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveReaderLocation,
  loadSavedReaderLocation,
  parseReaderLocation,
  saveReaderLocation,
  stringifyReaderLocation,
} from './readerLocation';

describe('readerLocation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('parses and serializes city and coordinate locations', () => {
    expect(parseReaderLocation('Shanghai~上海')).toEqual({
      location: 'Shanghai',
      displayName: '上海',
    });
    expect(parseReaderLocation('31.23,121.47')).toEqual({ location: '31.23,121.47' });
    expect(stringifyReaderLocation({ location: 'Shanghai', displayName: '上海' })).toBe(
      'Shanghai~上海',
    );
  });

  it('uses a saved location when reader layout has no location parameter', () => {
    saveReaderLocation({ location: 'Hangzhou', displayName: '杭州' });

    expect(loadSavedReaderLocation()).toEqual({ location: 'Hangzhou', displayName: '杭州' });
    expect(getActiveReaderLocation('?layout=reader')).toEqual({
      location: 'Hangzhou',
      displayName: '杭州',
    });
  });

  it('requires reader layout and prefers the URL location', () => {
    saveReaderLocation({ location: 'Hangzhou', displayName: '杭州' });

    expect(
      getActiveReaderLocation('?layout=reader&location=Shanghai%7E%E4%B8%8A%E6%B5%B7'),
    ).toEqual({ location: 'Shanghai', displayName: '上海' });
    expect(getActiveReaderLocation('?location=Shanghai')).toBeNull();
  });
});
