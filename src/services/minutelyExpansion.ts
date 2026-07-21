import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import { getWeatherPointTimeMs, HOUR_MS } from './timelineTime';

export const MINUTELY_EXPANDED_MIN_SPAN = 2;
export const MINUTELY_EXPANDED_MAX_SPAN = 3;
export const EXPANDED_MINUTELY_COLUMN_WIDTH = 132;

const MINUTELY_FORECAST_DURATION_MS = 2 * HOUR_MS;
const MINUTE_MS = 60 * 1000;

export function getExpandedMinutelyWidth(span: number): number {
  return EXPANDED_MINUTELY_COLUMN_WIDTH * Math.max(1, Math.round(span));
}

export function getMinutelyExpandedSpanForTimes(
  originMs: number | null,
  referenceTimeMs: number | null,
  points: ReadonlyArray<{ fxTime: string }> = [],
): number {
  if (originMs == null) return MINUTELY_EXPANDED_MAX_SPAN;

  const lastPointMs = points.reduce((latest, point) => {
    const pointMs = Date.parse(point.fxTime);
    return Number.isFinite(pointMs) ? Math.max(latest, pointMs) : latest;
  }, Number.NEGATIVE_INFINITY);
  const coverageEndMs = Number.isFinite(lastPointMs)
    ? lastPointMs
    : referenceTimeMs != null && Number.isFinite(referenceTimeMs)
      ? Math.floor(referenceTimeMs / MINUTE_MS) * MINUTE_MS + MINUTELY_FORECAST_DURATION_MS
      : null;
  if (coverageEndMs == null) return MINUTELY_EXPANDED_MAX_SPAN;

  const requiredSpan = Math.ceil((coverageEndMs - originMs) / HOUR_MS);
  return Math.max(MINUTELY_EXPANDED_MIN_SPAN, Math.min(MINUTELY_EXPANDED_MAX_SPAN, requiredSpan));
}

export function getMinutelySelectionExpandedSpan(
  selection: MinutelyPrecipitationSelection | null | undefined,
  dataLength = Number.POSITIVE_INFINITY,
): number {
  if (!selection) return 0;
  const availableSpan = dataLength - selection.index;
  if (Number.isFinite(availableSpan) && availableSpan <= 0) return 0;

  const updateTimeMs = Date.parse(selection.data?.updateTime ?? '');
  const referenceTimeMs =
    selection.referenceTimeMs ?? (Number.isFinite(updateTimeMs) ? updateTimeMs : null);
  const desiredSpan = getMinutelyExpandedSpanForTimes(
    getWeatherPointTimeMs(selection.item),
    referenceTimeMs,
    selection.data?.points,
  );
  return Math.max(1, Math.min(desiredSpan, availableSpan));
}
