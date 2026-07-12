import { useEffect, useMemo, useState } from 'react';
import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import {
  getIndicatorPosition,
  getMinutelyIndicatorPosition,
} from '../services/currentTimePosition';
import type { WeatherPoint } from '../types/weather';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';

interface CurrentTimeIndicatorProps {
  data: WeatherPoint[];
  hourWidth?: number;
  minutelySelection?: MinutelyPrecipitationSelection | null | undefined;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function CurrentTimeIndicator({
  data,
  hourWidth = DEFAULT_HOUR_WIDTH,
  minutelySelection = null,
}: CurrentTimeIndicatorProps) {
  const [now, setNow] = useState(() => new Date());
  const layout = useTimelineLayout(data.length, hourWidth);

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
    if (minutelySelection) {
      const minutelyLeft = getMinutelyIndicatorPosition(minutelySelection, now.getTime(), layout);
      if (minutelyLeft != null) return minutelyLeft;
    }
    return getIndicatorPosition(data, now.getTime(), layout);
  }, [data, now, layout, minutelySelection]);

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
