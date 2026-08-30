import { describe, expect, it } from 'vitest';
import {
  patternForAod,
  patternForAqi,
  patternForVisibility,
} from './monoScales';

describe('monochrome scale mappings', () => {
  it.each([
    [50, 'empty'],
    [100, 'dots-1'],
    [150, 'dots-2'],
    [200, 'diagonal-1'],
    [300, 'diagonal-2'],
    [301, 'crosshatch'],
  ])('maps AQI %s to %s', (value, expected) => {
    expect(patternForAqi(value)).toBe(expected);
  });

  it.each([
    [10, 'empty'],
    [4, 'dots-1'],
    [1, 'horizontal'],
    [0.9, 'crosshatch'],
  ])('maps visibility %s km to %s', (value, expected) => {
    expect(patternForVisibility(value)).toBe(expected);
  });

  it.each([
    [null, 'empty'],
    [0.1, 'dots-1'],
    [0.25, 'dots-2'],
    [0.65, 'diagonal-1'],
    [1, 'crosshatch'],
  ])('maps AOD %s to %s', (value, expected) => {
    expect(patternForAod(value)).toBe(expected);
  });
});
