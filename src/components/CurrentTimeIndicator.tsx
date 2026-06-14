import { useEffect, useMemo, useState } from 'react';
import type { WeatherPoint } from '../types/weather';
import { DEFAULT_HOUR_WIDTH, getHourCenter } from '../services/timelineLayout';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

interface CurrentTimeIndicatorProps {
  data: WeatherPoint[];
  hourWidth?: number;
}

function getItemTimeMs(item: WeatherPoint): number | null {
  const timeUtcMs = item.timeUtcMs;
  if (timeUtcMs != null && Number.isFinite(timeUtcMs)) return timeUtcMs;

  const ms = new Date(item.time).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getIndicatorPosition(data: WeatherPoint[], nowMs: number, hourWidth: number): number | null {
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;

    const startMs = getItemTimeMs(item);
    if (startMs == null) continue;

    const nextItem = data[i + 1];
    const nextMs = nextItem && nextItem.cityName === item.cityName
      ? getItemTimeMs(nextItem)
      : null;
    const endMs = nextMs != null && nextMs > startMs && nextMs - startMs <= HOUR_MS * 3
      ? nextMs
      : startMs + HOUR_MS;

    if (nowMs >= startMs && nowMs < endMs) {
      const fraction = Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
      return getHourCenter(i + fraction, hourWidth);
    }
  }

  return null;
}

export default function CurrentTimeIndicator({ data, hourWidth = DEFAULT_HOUR_WIDTH }: CurrentTimeIndicatorProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    const intervalId = window.setInterval(updateNow, 30 * 1000);

    window.addEventListener('focus', updateNow);
    document.addEventListener('visibilitychange', updateNow);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', updateNow);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, []);

  const left = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return null;
    return getIndicatorPosition(data, now.getTime(), hourWidth);
  }, [data, now, hourWidth]);

  if (left == null) return null;

  return (
    <div
      className="current-time-indicator"
      style={{ left: `${left}px` }}
      aria-label={`当前时间 ${formatClock(now)}`}
    >
      <div className="current-time-indicator-label">现在 {formatClock(now)}</div>
      <div className="current-time-indicator-line" />
    </div>
  );
}
