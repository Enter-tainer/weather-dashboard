import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import type { WeatherPoint } from '../types/weather';
import { useSearchParam } from './useSearchParam';

export interface SoundingSelection {
  activeSoundingItem: WeatherPoint | null;
  closeSounding: () => void;
  selectSoundingItem: (item: WeatherPoint) => void;
  soundingIndex: number;
  stepSounding: (direction: number) => void;
}

export function useSoundingSelection(data: WeatherPoint[] | null | undefined): SoundingSelection {
  const soundingTime = useSearchParam('sounding');

  const soundingIndex = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0 || soundingTime == null) {
      return -1;
    }

    return data.findIndex(item => item.time === soundingTime);
  }, [data, soundingTime]);

  const activeSoundingItem = Array.isArray(data) && soundingIndex >= 0
    ? data[soundingIndex] ?? null
    : null;

  const setSoundingTime = useCallback((time: string | null) => {
    setSearchParam('sounding', time);
  }, []);

  const selectSoundingItem = useCallback((item: WeatherPoint) => {
    if (item?.time) setSoundingTime(item.time);
  }, [setSoundingTime]);

  const closeSounding = useCallback(() => {
    setSoundingTime(null);
  }, [setSoundingTime]);

  const stepSounding = useCallback((direction: number) => {
    if (!Array.isArray(data) || soundingIndex < 0) return;

    const nextIndex = soundingIndex + direction;
    if (nextIndex < 0 || nextIndex >= data.length) return;

    const nextItem = data[nextIndex];
    if (nextItem) setSoundingTime(nextItem.time);
  }, [data, setSoundingTime, soundingIndex]);

  return {
    activeSoundingItem,
    closeSounding,
    selectSoundingItem,
    soundingIndex,
    stepSounding,
  };
}
