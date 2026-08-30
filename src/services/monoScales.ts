import type { MonoPatternId } from './monoPatterns';

export function patternForAqi(aqi: number | null | undefined): MonoPatternId {
  if (aqi == null || aqi <= 50) return 'empty';
  if (aqi <= 100) return 'dots-1';
  if (aqi <= 150) return 'dots-2';
  if (aqi <= 200) return 'diagonal-1';
  if (aqi <= 300) return 'diagonal-2';
  return 'crosshatch';
}

export function patternForVisibility(km: number | null | undefined): MonoPatternId {
  if (km == null || km >= 10) return 'empty';
  if (km >= 4) return 'dots-1';
  if (km >= 1) return 'horizontal';
  return 'crosshatch';
}

export function patternForAod(aod: number | null | undefined): MonoPatternId {
  if (aod == null || aod < 0.1) return 'empty';
  if (aod < 0.25) return 'dots-1';
  if (aod < 0.65) return 'dots-2';
  if (aod < 1) return 'diagonal-1';
  return 'crosshatch';
}
