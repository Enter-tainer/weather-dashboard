export const MINUTELY_CHART_AXIS_WIDTH = 0;
export const MINUTELY_CHART_RIGHT_INSET = 6;
export const PRECIP_BAR_MAX_HEIGHT = 40;
export const PRECIP_BAR_PX_PER_MM_HOUR = 4;
export const PRECIP_AXIS_MAX_MM_HOUR = PRECIP_BAR_MAX_HEIGHT / PRECIP_BAR_PX_PER_MM_HOUR;
export const PRECIP_AXIS_TICKS_MM_HOUR = [0, 1, 5, 10] as const;

export const PRECIP_INTENSITY_BANDS = [
  { label: '小雨', minRate: 0, maxRate: 1 },
  { label: '中雨', minRate: 1, maxRate: 5 },
  { label: '大雨', minRate: 5, maxRate: PRECIP_AXIS_MAX_MM_HOUR },
] as const;

export interface MinutelyChartHorizontalGeometry {
  plotLeft: number;
  plotRight: number;
  slotWidth: number;
  getPointCenter: (index: number) => number;
}

export function createMinutelyChartHorizontalGeometry(
  detailLeft: number,
  detailWidth: number,
  pointCount: number,
): MinutelyChartHorizontalGeometry {
  const plotLeft = detailLeft + MINUTELY_CHART_AXIS_WIDTH;
  const plotRight = Math.max(plotLeft, detailLeft + detailWidth - MINUTELY_CHART_RIGHT_INSET);
  const slotWidth = pointCount > 0 ? (plotRight - plotLeft) / pointCount : 0;

  return {
    plotLeft,
    plotRight,
    slotWidth,
    getPointCenter: (index: number) => plotLeft + (index + 0.5) * slotWidth,
  };
}

export function getHourlyPrecipBarHeight(precipMmPerHour: number): number {
  return Math.min(PRECIP_BAR_MAX_HEIGHT, Math.max(0, precipMmPerHour) * PRECIP_BAR_PX_PER_MM_HOUR);
}

export function getMinutelyEquivalentHourlyRate(precipMmPerFiveMinutes: number): number {
  return Math.max(0, precipMmPerFiveMinutes) * 12;
}

export function getMinutelyPrecipBarHeight(precipMmPerFiveMinutes: number): number {
  return getHourlyPrecipBarHeight(getMinutelyEquivalentHourlyRate(precipMmPerFiveMinutes));
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
