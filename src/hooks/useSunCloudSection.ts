import { useEffect, useRef, useState } from 'react';
import { fetchSunCloudSection } from '../services/sunCloudSection';
import type { CloudSection } from '../services/sunCloudSection';
import type { SunDirectionInfo } from '../services/sunDirection';
import type { WeatherPoint } from '../types/weather';

export type SunCloudSectionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface SunCloudSectionState {
  status: SunCloudSectionStatus;
  data: CloudSection | null;
  error: string | null;
}

const IDLE: SunCloudSectionState = { status: 'idle', data: null, error: null };

export function useSunCloudSection(
  origin: WeatherPoint | null,
  direction: SunDirectionInfo | null,
): SunCloudSectionState {
  const [state, setState] = useState<SunCloudSectionState>(IDLE);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!origin || !direction) {
      setState(IDLE);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading', data: null, error: null });

    let cancelled = false;
    fetchSunCloudSection(origin, direction)
      .then((result) => {
        if (cancelled || controller.signal.aborted) return;
        if (result == null) {
          setState({ status: 'error', data: null, error: '暂无朝日方向云况数据' });
          return;
        }
        setState({ status: 'success', data: result, error: null });
      })
      .catch(() => {
        if (cancelled || controller.signal.aborted) return;
        setState({ status: 'error', data: null, error: '朝日方向云况加载失败' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [origin, direction]);

  // Abort any in-flight request on unmount.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return state;
}
