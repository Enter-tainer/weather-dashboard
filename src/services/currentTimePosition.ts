import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import type { WeatherPoint } from '../types/weather';
import { createMinutelyChartHorizontalGeometry } from './minutelyChart';
import type { TimelineLayout } from './timelineLayout';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function getItemTimeMs(item: WeatherPoint): number | null {
  const timeUtcMs = item.timeUtcMs;
  if (timeUtcMs != null && Number.isFinite(timeUtcMs)) return timeUtcMs;

  const ms = new Date(item.time).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function getIndicatorPosition(
  data: WeatherPoint[],
  nowMs: number,
  layout: TimelineLayout,
): number | null {
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;

    const startMs = getItemTimeMs(item);
    if (startMs == null) continue;

    const nextItem = data[i + 1];
    const nextMs = nextItem && nextItem.cityName === item.cityName ? getItemTimeMs(nextItem) : null;
    const endMs =
      nextMs != null && nextMs > startMs && nextMs - startMs <= HOUR_MS * 3
        ? nextMs
        : startMs + HOUR_MS;

    if (nowMs >= startMs && nowMs < endMs) {
      const fraction = Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
      // TimelineLayout.getPoint uses integer positions for column centers. A clock
      // interval starts at the column's left edge, hence the half-column offset.
      return layout.getPoint(i - 0.5 + fraction);
    }
  }

  return null;
}

export function getMinutelyIndicatorPosition(
  selection: MinutelyPrecipitationSelection,
  nowMs: number,
  layout: TimelineLayout,
): number | null {
  const points = selection.data?.points ?? [];
  if (points.length === 0) return null;
  const firstMs = Date.parse(points[0]?.fxTime ?? '');
  if (!Number.isFinite(firstMs)) return null;

  const secondMs = Date.parse(points[1]?.fxTime ?? '');
  const stepMs =
    Number.isFinite(secondMs) && secondMs > firstMs ? secondMs - firstMs : 5 * MINUTE_MS;
  const lastMs = Date.parse(points.at(-1)?.fxTime ?? '');
  if (nowMs < firstMs - stepMs || (Number.isFinite(lastMs) && nowMs > lastMs + stepMs)) return null;

  const endIndex = Math.min(layout.length, selection.index + layout.expandedSpan);
  const geometry = createMinutelyChartHorizontalGeometry(
    layout.getColumnLeft(selection.index),
    layout.getRangeWidth(selection.index, endIndex),
    points.length,
  );
  const firstCenter = geometry.getPointCenter(0);
  const left = firstCenter + ((nowMs - firstMs) / stepMs) * geometry.slotWidth;
  return Math.max(geometry.plotLeft, Math.min(geometry.plotRight, left));
}
