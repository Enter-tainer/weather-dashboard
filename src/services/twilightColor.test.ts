import { describe, expect, it } from 'vitest';
import { altitudeToTwilightColor, colorWithAlpha, type TwilightPalette } from './twilightColor';

const PALETTE: TwilightPalette = {
  day: '#ffffff',
  warmDay: '#ffe0b2',
  golden: '#ff9800',
  blue: '#3949ab',
  nautical: '#1a237e',
  night: '#0d0d1a',
};

describe('twilight colors', () => {
  it('uses blue at civil-twilight start and warms toward the horizon', () => {
    expect(altitudeToTwilightColor(-6, PALETTE)).toBe('rgb(57,73,171)');
    expect(altitudeToTwilightColor(-4, PALETTE)).toBe('rgb(255,152,0)');
    expect(altitudeToTwilightColor(-1, PALETTE)).toBe('rgb(255,174,53)');
  });

  it('adds a clamped alpha channel to hex and rgb colors', () => {
    expect(colorWithAlpha('#3949ab', 0.25)).toBe('rgba(57, 73, 171, 0.25)');
    expect(colorWithAlpha('rgb(255,152,0)', 2)).toBe('rgba(255, 152, 0, 1)');
  });

  it('interpolates 3-digit hex palette entries (build-minified #fff) without NaN', () => {
    // CSS minifiers shorten #ffffff -> #fff; lerpColor must not emit rgb(x,y,NaN).
    const minified: TwilightPalette = { ...PALETTE, day: '#fff' };
    const c = altitudeToTwilightColor(8, minified); // 6-10° band lerps warmDay -> day
    expect(c).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    expect(c).not.toContain('NaN');
    // And a fully-overlap interpolation stays finite.
    expect(altitudeToTwilightColor(10, minified)).toBe('#fff');
  });
});
