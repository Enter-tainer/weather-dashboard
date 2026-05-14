export const SOUNDING_PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300];

export const APPROX_PRESSURE_HEIGHTS = {
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
};

export function dewPointFromRh(tempC, relativeHumidity) {
  if (tempC == null || relativeHumidity == null || relativeHumidity <= 0) return null;

  const rh = Math.min(Math.max(relativeHumidity, 1), 100);
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

export function buildSurfaceSoundingPoint(item) {
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

export function withSurfaceLevel(item) {
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
export function toSkewtFormat(levels) {
  return levels
    .filter(l => l.temp != null)
    .map(l => ({
      press: l.pressure,
      hght: l.agl ?? APPROX_PRESSURE_HEIGHTS[l.pressure] ?? null,
      temp: l.temp,
      dwpt: l.dewPoint,
      wdir: l.windDir,
      wspd: l.windSpeed != null ? l.windSpeed / 3.6 : null, // km/h → m/s
    }))
    .filter(l => l.hght != null);
}

export function detectInversions(item) {
  const levels = withSurfaceLevel(item)
    .filter(level => level.temp != null)
    .map(level => ({
      ...level,
      agl: level.agl ?? APPROX_PRESSURE_HEIGHTS[level.pressure] ?? null,
    }))
    .filter(level => level.agl != null)
    .sort((a, b) => a.agl - b.agl);

  const inversions = [];
  let current = null;

  for (let i = 0; i < levels.length - 1; i++) {
    const lower = levels[i];
    const upper = levels[i + 1];
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
