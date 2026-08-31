import { describe, expect, it } from 'vitest';
import { parseLocationSpec, stringifyLocationSpec } from './locationSpec';

describe('locationSpec', () => {
  it('shares city, alias and coordinate syntax between route and reader locations', () => {
    expect(parseLocationSpec('Shanghai~上海')).toEqual({
      city: 'Shanghai',
      originalName: '上海',
    });
    expect(parseLocationSpec('31.2304,121.4737~家')).toEqual({
      lat: 31.2304,
      lon: 121.4737,
      originalName: '家',
    });
    expect(stringifyLocationSpec({ lat: 31.2304, lon: 121.4737, originalName: '家' })).toBe(
      '31.2304,121.4737~家',
    );
  });
});
