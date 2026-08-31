import { useEffect, useMemo, useState } from 'react';
import type { WeatherTimeline } from '../types/weather';
import { sliceRollingTimeline } from '../services/rollingTimeline';

export function useRollingTimeline(
  data: WeatherTimeline | null,
  enabled: boolean,
): WeatherTimeline | null {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    const updateNow = () => setNowMs(Date.now());
    const timer = window.setInterval(updateNow, 60 * 1000);
    window.addEventListener('focus', updateNow);
    window.addEventListener('pageshow', updateNow);
    document.addEventListener('visibilitychange', updateNow);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateNow);
      window.removeEventListener('pageshow', updateNow);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, [enabled]);

  return useMemo(
    () => (enabled && data ? sliceRollingTimeline(data, nowMs) : data),
    [data, enabled, nowMs],
  );
}
