import { useEffect, useMemo, useState } from 'react';

const COL_WIDTH = 22;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function getItemTimeMs(item) {
  if (Number.isFinite(item.timeUtcMs)) return item.timeUtcMs;

  const ms = new Date(item.time).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getIndicatorPosition(data, nowMs) {
  for (let i = 0; i < data.length; i++) {
    const startMs = getItemTimeMs(data[i]);
    if (startMs == null) continue;

    const nextMs = i < data.length - 1 && data[i + 1].cityName === data[i].cityName
      ? getItemTimeMs(data[i + 1])
      : null;
    const endMs = nextMs != null && nextMs > startMs && nextMs - startMs <= HOUR_MS * 3
      ? nextMs
      : startMs + HOUR_MS;

    if (nowMs >= startMs && nowMs < endMs) {
      const fraction = Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
      return (i + fraction) * COL_WIDTH + COL_WIDTH / 2;
    }
  }

  return null;
}

export default function CurrentTimeIndicator({ data }) {
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
    return getIndicatorPosition(data, now.getTime());
  }, [data, now]);

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
