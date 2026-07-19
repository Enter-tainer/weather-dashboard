import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import type { SunEvent, WeatherPoint, WeatherTimeline } from '../types/weather';
import { useSearchParam } from './useSearchParam';

export interface SunViewSelection {
  activeSunEvent: SunEvent | null;
  originItem: WeatherPoint | null;
  selectSunEvent: (ev: SunEvent) => void;
  closeSunView: () => void;
}

function decodeSunView(raw: string | null): { originTime: string; type: string } | null {
  if (!raw) return null;
  const sep = raw.indexOf('|');
  if (sep < 0) return null;
  const originTime = raw.slice(0, sep);
  const type = raw.slice(sep + 1);
  if (!originTime || (type !== 'sunrise' && type !== 'sunset')) return null;
  return { originTime, type };
}

export function useSunViewSelection(data: WeatherTimeline | null | undefined): SunViewSelection {
  const raw = useSearchParam('sunview');

  const { activeSunEvent, originItem } = useMemo(() => {
    const decoded = decodeSunView(raw);
    if (!decoded || !Array.isArray(data) || data.length === 0) {
      return { activeSunEvent: null, originItem: null };
    }
    const originIndex = data.findIndex((item) => item.time === decoded.originTime);
    if (originIndex < 0) return { activeSunEvent: null, originItem: null };

    const sunEvents = data.sunEvents ?? [];
    const match = sunEvents.find(
      (ev) =>
        ev.type === decoded.type &&
        ev.absoluteIndex != null &&
        Math.round(ev.absoluteIndex) === originIndex,
    );
    if (!match) return { activeSunEvent: null, originItem: null };

    return {
      activeSunEvent: match,
      originItem: data[originIndex] ?? null,
    };
  }, [data, raw]);

  const selectSunEvent = useCallback(
    (ev: SunEvent) => {
      if (ev.absoluteIndex == null) return;
      const originIndex = Math.round(ev.absoluteIndex);
      const origin = Array.isArray(data) ? data[originIndex] : undefined;
      if (!origin?.time) return;
      setSearchParam('sunview', `${origin.time}|${ev.type}`);
    },
    [data],
  );

  const closeSunView = useCallback(() => {
    setSearchParam('sunview', null);
  }, []);

  return { activeSunEvent, originItem, selectSunEvent, closeSunView };
}
