import type { SkewTLevel, SoundingLevel, WeatherPoint } from '../types/weather';

export const SOUNDING_PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200] as const;

export const APPROX_PRESSURE_HEIGHTS: Readonly<Record<number, number>> = {
  1000: 110,
  975: 320,
  950: 500,
  925: 800,
  900: 1000,
  850: 1500,
  800: 1900,
  700: 3000,
  600: 4200,
  500: 5600,
  400: 7200,
  300: 9200,
  250: 10800,
  200: 12300,
} as const;

export interface InversionLayer {
  baseM: number;
  topM: number;
  strengthC: number;
  gradientCPer100m: number;
}

export function dewPointFromRh(tempC: number | null, relativeHumidity: number | null): number | null {
  if (tempC == null || relativeHumidity == null || relativeHumidity <= 0) return null;

  const rh = Math.min(Math.max(relativeHumidity, 1), 100);
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

export function buildSurfaceSoundingPoint(item: WeatherPoint | null | undefined): SoundingLevel | null {
  if (!item || item.temperature == null || item.pressure == null) return null;

  return {
    pressure: item.pressure,
    temp: item.temperature,
    dewPoint: item.dewPoint,
    relativeHumidity: item.humidity,
    altitude: null,
    agl: 2,
    windSpeed: item.windSpeed,
    windDir: item.windDir,
    surface: true,
  };
}

export function withSurfaceLevel(item: WeatherPoint | null | undefined): SoundingLevel[] {
  const levels = item?.soundingLevels || [];
  const surface = buildSurfaceSoundingPoint(item);
  return surface ? [surface, ...levels] : levels;
}

/**
 * Convert sounding levels to the format expected by the `skewt` npm package.
 * skewt expects: { press, hght, temp, dwpt, wdir, wspd }
 *   - wspd must be in **meters per second** (m/s); our data is in km/h.
 *   - hght uses agl (or approximate height from pressure).
 *   - Levels with null temp are filtered out.
 */
function hasSkewTFields(level: SoundingLevel): level is SoundingLevel & {
  temp: number;
  dewPoint: number;
  windDir: number;
  windSpeed: number;
} {
  return (
    level.temp != null
    && level.dewPoint != null
    && level.windDir != null
    && level.windSpeed != null
  );
}

export function toSkewtFormat(levels: SoundingLevel[]): SkewTLevel[] {
  return levels
    .filter(hasSkewTFields)
    .map((level): SkewTLevel | null => {
      const hght = level.agl ?? APPROX_PRESSURE_HEIGHTS[level.pressure] ?? null;
      if (hght == null) return null;

      return {
        press: level.pressure,
        hght,
        temp: level.temp,
        dwpt: level.dewPoint,
        wdir: level.windDir,
        wspd: level.windSpeed / 3.6, // km/h -> m/s
      };
    })
    .filter((level): level is SkewTLevel => level != null);
}

export function detectInversions(item: WeatherPoint | null | undefined): InversionLayer[] {
  const levels = withSurfaceLevel(item)
    .filter((level): level is SoundingLevel & { temp: number } => level.temp != null)
    .map(level => ({
      ...level,
      agl: level.agl ?? APPROX_PRESSURE_HEIGHTS[level.pressure] ?? null,
    }))
    .filter((level): level is SoundingLevel & { temp: number; agl: number } => level.agl != null)
    .sort((a, b) => a.agl - b.agl);

  const inversions: Omit<InversionLayer, 'gradientCPer100m'>[] = [];
  let current: Omit<InversionLayer, 'gradientCPer100m'> | null = null;

  for (let i = 0; i < levels.length - 1; i++) {
    const lower = levels[i];
    const upper = levels[i + 1];
    if (!lower || !upper) continue;
    const deltaTemp = upper.temp - lower.temp;
    const deltaHeight = upper.agl - lower.agl;

    if (deltaHeight <= 0 || deltaTemp <= 0.2) {
      if (current) {
        inversions.push(current);
        current = null;
      }
      continue;
    }

    if (!current) {
      current = {
        baseM: lower.agl,
        topM: upper.agl,
        strengthC: deltaTemp,
      };
    } else {
      current.topM = upper.agl;
      current.strengthC += deltaTemp;
    }
  }

  if (current) inversions.push(current);

  return inversions.map(inv => ({
    ...inv,
    gradientCPer100m: inv.topM > inv.baseM
      ? inv.strengthC / ((inv.topM - inv.baseM) / 100)
      : 0,
  }));
}
