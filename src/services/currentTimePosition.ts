import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import type { WeatherPoint } from '../types/weather';
import {
  createMinutelyChartHorizontalGeometry,
  type MinutelyChartTimeParams,
} from './minutelyChart';
import type { TimelineLayout } from './timelineLayout';
import { getWeatherPointIntervalEndMs, getWeatherPointTimeMs, HOUR_MS } from './timelineTime';

const MINUTE_MS = 60 * 1000;
const DEFAULT_STEP_MS = 5 * MINUTE_MS;

/**
 * Derives the wall-clock anchors shared by the minutely bars, time-axis ticks, and
 * the now-indicator. `originMs` is the start of the selected hour (the expanded
 * region's left edge) so bars/ticks/now line up with the hourly cell boundaries.
 */
export function getMinutelyChartTimeParams(
  selection: MinutelyPrecipitationSelection,
  layout: TimelineLayout,
): MinutelyChartTimeParams | null {
  const points = selection.data?.points ?? [];
  if (points.length === 0) return null;

  const firstPointMs = Date.parse(points[0]?.fxTime ?? '');
  if (!Number.isFinite(firstPointMs)) return null;

  const secondMs = Date.parse(points[1]?.fxTime ?? '');
  const stepMs =
    Number.isFinite(secondMs) && secondMs > firstPointMs
      ? secondMs - firstPointMs
      : DEFAULT_STEP_MS;

  const originMs = getWeatherPointTimeMs(selection.item);
  if (originMs == null) return null;

  const spanMs = Math.max(DEFAULT_STEP_MS, layout.expandedSpan * HOUR_MS);
  return { originMs, spanMs, firstPointMs, stepMs };
}

export function getIndicatorPosition(
  data: WeatherPoint[],
  nowMs: number,
  layout: TimelineLayout,
): number | null {
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;

    const startMs = getWeatherPointTimeMs(item);
    if (startMs == null) continue;

    const nextItem = data[i + 1];
    const nextMs =
      nextItem && nextItem.cityName === item.cityName ? getWeatherPointTimeMs(nextItem) : null;
    const endMs =
      nextMs != null && nextMs > startMs && nextMs - startMs <= HOUR_MS * 6
        ? nextMs
        : getWeatherPointIntervalEndMs(item);

    if (endMs == null || endMs <= startMs) continue;

    if (nowMs >= startMs && nowMs < endMs) {
      const fraction = Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
      return layout.getTimePosition(i + fraction);
    }
  }

  return null;
}

export function getMinutelyIndicatorPosition(
  selection: MinutelyPrecipitationSelection,
  nowMs: number,
  layout: TimelineLayout,
): number | null {
  const timeParams = getMinutelyChartTimeParams(selection, layout);
  if (!timeParams) return null;

  // Show the indicator across the whole expanded region; outside it, fall back to
  // the hourly indicator so the now-line never disappears mid-region.
  const { originMs, spanMs } = timeParams;
  if (nowMs < originMs || nowMs >= originMs + spanMs) return null;

  const points = selection.data?.points ?? [];
  const endIndex = Math.min(layout.length, selection.index + layout.expandedSpan);
  const geometry = createMinutelyChartHorizontalGeometry(
    layout.getColumnLeft(selection.index),
    layout.getRangeWidth(selection.index, endIndex),
    points.length,
    timeParams,
  );
  return geometry.getXForTime(nowMs);
}
