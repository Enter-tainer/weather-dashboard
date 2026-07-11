export const MINUTELY_CHART_AXIS_WIDTH = 0;
export const MINUTELY_CHART_RIGHT_INSET = 6;
export const PRECIP_BAR_MAX_HEIGHT = 40;
export const PRECIP_BAR_PX_PER_MM_HOUR = 4;
export const PRECIP_AXIS_MAX_MM_HOUR = PRECIP_BAR_MAX_HEIGHT / PRECIP_BAR_PX_PER_MM_HOUR;
export const PRECIP_AXIS_TICKS_MM_HOUR = [0, 5, 10] as const;

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

export function getMinutelyTimeTickIndices(
  points: ReadonlyArray<{ fxTime: string }>,
  intervalMinutes = 30,
): number[] {
  const safeInterval = Math.max(5, Math.round(intervalMinutes));
  return points.flatMap((point, index) => {
    const match = /T\d{2}:(\d{2})/.exec(point.fxTime);
    const minute = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
    return Number.isFinite(minute) && minute % safeInterval === 0 ? [index] : [];
  });
}
