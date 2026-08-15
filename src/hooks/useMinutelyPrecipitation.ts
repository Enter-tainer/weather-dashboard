import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMinutelyPrecipitation } from '../services/qweather';
import type { MinutelyPrecipitation, WeatherPoint } from '../types/weather';
import {
  alignMinutelySelectionToData,
  getMinutelyExpandedSpanForTimes,
} from '../services/minutelyExpansion';
import { getWeatherPointTimeMs, HOUR_MS } from '../services/timelineTime';

export type MinutelyPrecipitationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MinutelyPrecipitationSelection {
  index: number;
  item: WeatherPoint;
  status: MinutelyPrecipitationStatus;
  data: MinutelyPrecipitation | null;
  error: string | null;
  referenceTimeMs?: number;
}

function findSelectionIndex(data: readonly WeatherPoint[], item: WeatherPoint): number {
  const selectedTimeMs = getWeatherPointTimeMs(item);
  if (selectedTimeMs == null) return -1;

  return data.findIndex(
    (candidate) =>
      candidate.cityName === item.cityName &&
      candidate.latitude === item.latitude &&
      candidate.longitude === item.longitude &&
      getWeatherPointTimeMs(candidate) === selectedTimeMs,
  );
}

function rebaseSelectionToData(
  selection: MinutelyPrecipitationSelection,
  data: readonly WeatherPoint[],
): MinutelyPrecipitationSelection | null {
  const index = findSelectionIndex(data, selection.item);
  const item = data[index];
  if (index < 0 || !item) return null;
  return index === selection.index ? selection : { ...selection, index, item };
}

export function getMinutelyEligibleIndices(data: WeatherPoint[], nowMs: number): Set<number> {
  const eligible = new Set<number>();
  const currentIndex = data.findIndex((item, index) => {
    const startMs = getWeatherPointTimeMs(item);
    if (startMs == null) return false;

    const next = data[index + 1];
    const nextMs = next?.cityName === item.cityName ? getWeatherPointTimeMs(next) : null;
    const endMs = nextMs != null && nextMs > startMs ? nextMs : startMs + HOUR_MS;
    return nowMs >= startMs && nowMs < endMs;
  });

  if (currentIndex < 0) return eligible;
  const current = data[currentIndex];
  if (current?.latitude == null || current.longitude == null) return eligible;

  const currentMs = getWeatherPointTimeMs(current);
  const expandedSpan = getMinutelyExpandedSpanForTimes(currentMs, nowMs);

  eligible.add(currentIndex);
  const next = data[currentIndex + 1];
  const nextMs = next ? getWeatherPointTimeMs(next) : null;
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

  const third = expandedSpan >= 3 ? data[currentIndex + 2] : null;
  const thirdMs = third ? getWeatherPointTimeMs(third) : null;
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
  const dataRef = useRef(data);
  dataRef.current = data;
  const availableIndices = useMemo(
    () => (enabled ? getMinutelyEligibleIndices(data, nowMs) : new Set<number>()),
    [data, enabled, nowMs],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setSelection(null);
      return;
    }

    setSelection((currentSelection) =>
      currentSelection ? rebaseSelectionToData(currentSelection, data) : currentSelection,
    );
  }, [data, enabled]);

  useEffect(() => {
    if (!selection && controllerRef.current) {
      controllerRef.current?.abort();
      controllerRef.current = null;
    }
  }, [selection]);

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
      const referenceTimeMs = nowMs;
      setSelection({ index, item, status: 'loading', data: null, error: null, referenceTimeMs });

      fetchMinutelyPrecipitation(item.latitude, item.longitude, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setSelection((currentSelection) => {
            if (!currentSelection || controller.signal.aborted) return currentSelection;

            const currentData = dataRef.current;
            const rebasedSelection = rebaseSelectionToData(
              {
                index,
                item,
                status: 'success',
                data: result,
                error: null,
                referenceTimeMs,
              },
              currentData,
            );
            return rebasedSelection
              ? alignMinutelySelectionToData(rebasedSelection, currentData)
              : null;
          });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setSelection((currentSelection) => {
            if (!currentSelection || controller.signal.aborted) return currentSelection;
            return rebaseSelectionToData(
              {
                index,
                item,
                status: 'error',
                data: null,
                error: error instanceof Error ? error.message : '分钟级降水加载失败',
                referenceTimeMs,
              },
              dataRef.current,
            );
          });
        });
    },
    [availableIndices, close, data, nowMs, selection?.index],
  );

  return { availableIndices, selection, select, close };
}
