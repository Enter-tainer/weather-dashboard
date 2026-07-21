export const MINUTELY_CHART_AXIS_WIDTH = 0;
// Right inset is 0 so the chart's plot width equals the expanded region width and
// the minutely now-indicator lines up exactly with the hourly now-indicator (which
// uses the full cell width). The ≤2h data never reaches the 3-cell region's right
// edge, so no visual padding is lost.
export const MINUTELY_CHART_RIGHT_INSET = 0;
export const PRECIP_BAR_MAX_HEIGHT = 40;
export const PRECIP_BAR_PX_PER_MM_HOUR = 4;
export const PRECIP_AXIS_MAX_MM_HOUR = PRECIP_BAR_MAX_HEIGHT / PRECIP_BAR_PX_PER_MM_HOUR;
export const PRECIP_AXIS_TICKS_MM_HOUR = [0, 1, 5, 10] as const;

export const PRECIP_INTENSITY_BANDS = [
  { label: '小雨', minRate: 0, maxRate: 1 },
  { label: '中雨', minRate: 1, maxRate: 5 },
  { label: '大雨', minRate: 5, maxRate: PRECIP_AXIS_MAX_MM_HOUR },
] as const;

export interface MinutelyChartTimeParams {
  /** Wall-clock ms at the start of the selected hour (region left edge anchor). */
  originMs: number;
  /** Total time spanned by the expanded region: expandedSpan × HOUR_MS. */
  spanMs: number;
  /** Wall-clock ms of the first forecast point (≈ now, aligned to 5 min). */
  firstPointMs: number;
  /** Spacing between forecast points (5 min). */
  stepMs: number;
}

export interface MinutelyChartHorizontalGeometry {
  plotLeft: number;
  plotRight: number;
  slotWidth: number;
  getPointStart: (index: number) => number;
  getPointCenter: (index: number) => number;
  getXForTime: (ms: number) => number;
}

export function createMinutelyChartHorizontalGeometry(
  detailLeft: number,
  detailWidth: number,
  pointCount: number,
  timeParams: MinutelyChartTimeParams,
): MinutelyChartHorizontalGeometry {
  const plotLeft = detailLeft + MINUTELY_CHART_AXIS_WIDTH;
  const plotRight = Math.max(plotLeft, detailLeft + detailWidth - MINUTELY_CHART_RIGHT_INSET);
  const plotWidth = plotRight - plotLeft;
  const { originMs, spanMs, firstPointMs, stepMs } = timeParams;

  const timeToX = (ms: number): number => plotLeft + ((ms - originMs) / spanMs) * plotWidth;

  const clampX = (x: number): number => Math.max(plotLeft, Math.min(plotRight, x));

  // Each bar represents the 5-min slot starting at fxTime; centre it on that slot.
  const getPointStart = (index: number): number => {
    if (pointCount === 0) return plotLeft;
    return clampX(timeToX(firstPointMs + index * stepMs));
  };

  const getPointCenter = (index: number): number => {
    if (pointCount === 0) return plotLeft;
    const slotCenterMs = firstPointMs + (index + 0.5) * stepMs;
    return clampX(timeToX(slotCenterMs));
  };

  const getXForTime = (ms: number): number => clampX(timeToX(ms));

  return {
    plotLeft,
    plotRight,
    // Pixel width of a single 5-min slot, used to size bars.
    slotWidth: Math.max(0, (stepMs / spanMs) * plotWidth),
    getPointStart,
    getPointCenter,
    getXForTime,
  };
}

export function getHourlyPrecipBarHeight(precipMmPerHour: number): number {
  return getPrecipBarHeight(precipMmPerHour, PRECIP_AXIS_MAX_MM_HOUR);
}

export function getMinutelyEquivalentHourlyRate(precipMmPerFiveMinutes: number): number {
  return Math.max(0, precipMmPerFiveMinutes) * 12;
}

/**
 * Pick a linear minutely-chart ceiling which keeps the standard 0–10 mm/h scale for ordinary
 * rain, but expands to the actual peak during heavy bursts instead of flattening every bar at
 * 40px. Inputs are five-minute accumulation values in mm.
 */
export function getMinutelyPrecipAxisMax(precipitationMmPerFiveMinutes: readonly number[]): number {
  const peakRate = precipitationMmPerFiveMinutes.reduce(
    (peak, precip) => Math.max(peak, getMinutelyEquivalentHourlyRate(precip)),
    0,
  );
  return Math.max(PRECIP_AXIS_MAX_MM_HOUR, peakRate);
}

export function getMinutelyPrecipBarHeight(
  precipMmPerFiveMinutes: number,
  axisMaxMmPerHour = PRECIP_AXIS_MAX_MM_HOUR,
): number {
  return getPrecipBarHeight(
    getMinutelyEquivalentHourlyRate(precipMmPerFiveMinutes),
    axisMaxMmPerHour,
  );
}

function getPrecipBarHeight(rateMmPerHour: number, axisMaxMmPerHour: number): number {
  const safeRate = Math.max(0, rateMmPerHour);
  const safeAxisMax = Math.max(Number.EPSILON, axisMaxMmPerHour);
  return Math.min(PRECIP_BAR_MAX_HEIGHT, (safeRate / safeAxisMax) * PRECIP_BAR_MAX_HEIGHT);
}

interface MinutelyClockParts {
  hour: number;
  minute: number;
}

function getClockPartsFromOffset(
  timestampMs: number,
  utcOffsetSeconds: number,
): MinutelyClockParts {
  const shifted = new Date(timestampMs + utcOffsetSeconds * 1000);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

export function getMinutelyClockParts(
  fxTime: string,
  timezone?: string,
  utcOffsetSeconds?: number,
): MinutelyClockParts | null {
  const timestampMs = Date.parse(fxTime);
  if (Number.isFinite(timestampMs) && timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(timestampMs);
      const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value ?? '', 10);
      const minute = Number.parseInt(parts.find((part) => part.type === 'minute')?.value ?? '', 10);
      if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
    } catch {
      // Invalid or unsupported IANA timezone: fall through to the numeric offset/raw ISO time.
    }
  }

  if (
    Number.isFinite(timestampMs) &&
    utcOffsetSeconds != null &&
    Number.isFinite(utcOffsetSeconds)
  ) {
    return getClockPartsFromOffset(timestampMs, utcOffsetSeconds);
  }

  const match = /T(\d{2}):(\d{2})/.exec(fxTime);
  if (!match?.[1] || !match[2]) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  return Number.isFinite(hour) && Number.isFinite(minute) ? { hour, minute } : null;
}

export function formatMinutelyTime(
  fxTime: string,
  timezone?: string,
  utcOffsetSeconds?: number,
): string {
  const parts = getMinutelyClockParts(fxTime, timezone, utcOffsetSeconds);
  if (!parts) return '--:--';
  return `${parts.hour.toString().padStart(2, '0')}:${parts.minute.toString().padStart(2, '0')}`;
}

export function getMinutelyTimeTickIndices(
  points: ReadonlyArray<{ fxTime: string }>,
  intervalMinutes = 30,
  timezone?: string,
  utcOffsetSeconds?: number,
): number[] {
  const safeInterval = Math.max(5, Math.round(intervalMinutes));
  return points.flatMap((point, index) => {
    const parts = getMinutelyClockParts(point.fxTime, timezone, utcOffsetSeconds);
    return parts && parts.minute % safeInterval === 0 ? [index] : [];
  });
}
