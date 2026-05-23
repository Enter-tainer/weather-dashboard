import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

export function useSoundingSelection(data) {
  const soundingTime = useSearchParam('sounding');

  const soundingIndex = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0 || soundingTime == null) {
      return -1;
    }

    return data.findIndex(item => item.time === soundingTime);
  }, [data, soundingTime]);

  const activeSoundingItem = soundingIndex >= 0 ? data[soundingIndex] : null;

  const setSoundingTime = useCallback((time) => {
    setSearchParam('sounding', time);
  }, []);

  const selectSoundingItem = useCallback((item) => {
    if (item?.time) setSoundingTime(item.time);
  }, [setSoundingTime]);

  const closeSounding = useCallback(() => {
    setSoundingTime(null);
  }, [setSoundingTime]);

  const stepSounding = useCallback((direction) => {
    if (!Array.isArray(data) || soundingIndex < 0) return;

    const nextIndex = soundingIndex + direction;
    if (nextIndex < 0 || nextIndex >= data.length) return;

    setSoundingTime(data[nextIndex].time);
  }, [data, setSoundingTime, soundingIndex]);

  return {
    activeSoundingItem,
    closeSounding,
    selectSoundingItem,
    soundingIndex,
    stepSounding,
  };
}
