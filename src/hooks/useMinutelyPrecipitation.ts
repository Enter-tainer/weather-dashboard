import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMinutelyPrecipitation } from '../services/qweather';
import type { MinutelyPrecipitation, WeatherPoint } from '../types/weather';

const HOUR_MS = 60 * 60 * 1000;

export type MinutelyPrecipitationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MinutelyPrecipitationSelection {
  index: number;
  item: WeatherPoint;
  status: MinutelyPrecipitationStatus;
  data: MinutelyPrecipitation | null;
  error: string | null;
}

function getTimeMs(item: WeatherPoint): number | null {
  if (item.timeUtcMs != null && Number.isFinite(item.timeUtcMs)) return item.timeUtcMs;
  const parsed = new Date(item.time).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function getMinutelyEligibleIndices(data: WeatherPoint[], nowMs: number): Set<number> {
  const eligible = new Set<number>();
  const currentIndex = data.findIndex((item, index) => {
    const startMs = getTimeMs(item);
    if (startMs == null) return false;

    const next = data[index + 1];
    const nextMs = next?.cityName === item.cityName ? getTimeMs(next) : null;
    const endMs = nextMs != null && nextMs > startMs ? nextMs : startMs + HOUR_MS;
    return nowMs >= startMs && nowMs < endMs;
  });

  if (currentIndex < 0) return eligible;
  const current = data[currentIndex];
  if (current?.latitude == null || current.longitude == null) return eligible;

  eligible.add(currentIndex);
  const next = data[currentIndex + 1];
  const currentMs = getTimeMs(current);
  const nextMs = next ? getTimeMs(next) : null;
  if (
    next &&
    next.cityName === current.cityName &&
    next.latitude != null &&
    next.longitude != null &&
    currentMs != null &&
    nextMs != null &&
    nextMs - currentMs > 0 &&
    nextMs - currentMs <= HOUR_MS * 1.5
  ) {
    eligible.add(currentIndex + 1);
  }

  const third = data[currentIndex + 2];
  const thirdMs = third ? getTimeMs(third) : null;
  if (
    next &&
    third &&
    third.cityName === current.cityName &&
    third.latitude != null &&
    third.longitude != null &&
    nextMs != null &&
    thirdMs != null &&
    thirdMs - nextMs > 0 &&
    thirdMs - nextMs <= HOUR_MS * 1.5
  ) {
    eligible.add(currentIndex + 2);
  }

  return eligible;
}

export function useMinutelyPrecipitation(data: WeatherPoint[], enabled = true) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selection, setSelection] = useState<MinutelyPrecipitationSelection | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const availableIndices = useMemo(
    () => (enabled ? getMinutelyEligibleIndices(data, nowMs) : new Set<number>()),
    [data, enabled, nowMs],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selection && !availableIndices.has(selection.index)) setSelection(null);
  }, [availableIndices, selection]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const close = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setSelection(null);
  }, []);

  const select = useCallback(
    (index: number) => {
      if (selection?.index === index) {
        close();
        return;
      }

      const item = data[index];
      if (
        !item ||
        !availableIndices.has(index) ||
        item.latitude == null ||
        item.longitude == null
      ) {
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setSelection({ index, item, status: 'loading', data: null, error: null });

      fetchMinutelyPrecipitation(item.latitude, item.longitude, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setSelection({ index, item, status: 'success', data: result, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setSelection({
            index,
            item,
            status: 'error',
            data: null,
            error: error instanceof Error ? error.message : '分钟级降水加载失败',
          });
        });
    },
    [availableIndices, close, data, selection?.index],
  );

  return { availableIndices, selection, select, close };
}
