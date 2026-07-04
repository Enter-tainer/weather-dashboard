import { afterEach, describe, expect, it } from 'vitest';
import { cssVar } from './themeColors';

describe('cssVar', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('reads a CSS custom property from the root element', () => {
    document.documentElement.style.setProperty('--weather-test-color', '#123456');

    expect(cssVar('--weather-test-color', '#ffffff')).toBe('#123456');
  });

  it('uses the fallback when the property is not set', () => {
    expect(cssVar('--missing-weather-color', '#abcdef')).toBe('#abcdef');
  });
});
