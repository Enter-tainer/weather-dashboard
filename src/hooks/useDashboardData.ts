import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchCityDataForDate, assembleTimeline } from '../services/api';
import { parseRoute, parseSwitchableRoute, buildRouteForSelections } from '../services/urlParser';
import type { DateSlot, RouteEntry, WeatherTimeline } from '../types/weather';

export type SwitchInfo = Record<string, DateSlot>;

interface DashboardDataState {
  data: WeatherTimeline | null;
  loadingDone: boolean;
  dateSlots: DateSlot[] | null;
  switching: boolean;
  lastUpdatedAt: number | null;
  refreshing: boolean;
  refreshError: string | null;
}

type DashboardDataAction =
  | { type: 'test-data-loaded'; data: WeatherTimeline }
  | { type: 'load-started' }
  | { type: 'refresh-started' }
  | {
      type: 'refresh-completed';
      data: WeatherTimeline;
      dateSlots: DateSlot[] | null;
      updatedAt: number;
    }
  | { type: 'refresh-failed'; message: string }
  | { type: 'timeline-updated'; data: WeatherTimeline }
  | { type: 'loading-completed'; updatedAt: number }
  | { type: 'loading-failed' }
  | { type: 'date-slots-loaded'; dateSlots: DateSlot[] }
  | { type: 'switch-started'; dateSlots: DateSlot[] }
  | { type: 'switch-completed'; data: WeatherTimeline; updatedAt: number }
  | { type: 'switch-failed' };

interface StreamTimelineOptions {
  isCancelled: () => boolean;
  onTimeline: (timeline: WeatherTimeline) => void;
  onComplete: (hasData: boolean) => void;
}

export interface DashboardDataResult {
  data: WeatherTimeline | null;
  loadingDone: boolean;
  switching: boolean;
  switchInfo: SwitchInfo;
  handleCityClick: (cityName: string) => void;
  lastUpdatedAt: number | null;
  refreshing: boolean;
  refreshError: string | null;
  refresh: () => void;
}

function createEmptyTimeline(): WeatherTimeline {
  const timeline: WeatherTimeline = [];
  return timeline;
}

function createInitialState(testData: WeatherTimeline | null | undefined): DashboardDataState {
  return {
    data: testData ?? null,
    loadingDone: Boolean(testData),
    dateSlots: null,
    switching: false,
    lastUpdatedAt: testData ? Date.now() : null,
    refreshing: false,
    refreshError: null,
  };
}

function dashboardDataReducer(
  state: DashboardDataState,
  action: DashboardDataAction,
): DashboardDataState {
  switch (action.type) {
    case 'test-data-loaded':
      return createInitialState(action.data);

    case 'load-started':
      return createInitialState(null);

    case 'refresh-started':
      return { ...state, refreshing: true, refreshError: null };

    case 'refresh-completed':
      return {
        ...state,
        data: action.data,
        dateSlots: action.dateSlots,
        loadingDone: true,
        refreshing: false,
        refreshError: null,
        lastUpdatedAt: action.updatedAt,
      };

    case 'refresh-failed':
      return {
        ...state,
        loadingDone: true,
        refreshing: false,
        refreshError: action.message,
      };

    case 'timeline-updated':
      return { ...state, data: action.data };

    case 'loading-completed':
      return {
        ...state,
        loadingDone: true,
        lastUpdatedAt: action.updatedAt,
      };

    case 'loading-failed':
      return { ...state, loadingDone: true };

    case 'date-slots-loaded':
      return { ...state, dateSlots: action.dateSlots };

    case 'switch-started':
      return { ...state, dateSlots: action.dateSlots, switching: true, refreshError: null };

    case 'switch-completed':
      return {
        ...state,
        data: action.data,
        switching: false,
        lastUpdatedAt: action.updatedAt,
      };

    case 'switch-failed':
      return { ...state, switching: false };

    default:
      return state;
  }
}

function fetchCityDataSafely(entry: RouteEntry): Promise<WeatherTimeline> {
  return fetchCityDataForDate(entry).catch((error: unknown) => {
    console.error(error);
    return createEmptyTimeline();
  });
}

async function fetchCompleteTimeline(route: RouteEntry[]): Promise<WeatherTimeline> {
  if (route.length === 0) {
    throw new Error('Cannot refresh an empty route');
  }

  const results = await Promise.all(route.map(fetchCityDataForDate));
  if (results.some((timeline) => timeline.length === 0)) {
    throw new Error('At least one route segment returned no weather data');
  }

  const timeline = assembleTimeline(results);
  if (timeline.length === 0) {
    throw new Error('The refreshed route assembled to an empty timeline');
  }

  return timeline;
}

function streamTimeline(
  route: RouteEntry[],
  { isCancelled, onTimeline, onComplete }: StreamTimelineOptions,
): void {
  if (route.length === 0) {
    if (!isCancelled()) onComplete(false);
    return;
  }

  const results = Array.from({ length: route.length }, (): WeatherTimeline | null => null);
  let loaded = 0;
  let hasData = false;

  route.forEach((entry, index) => {
    void fetchCityDataSafely(entry).then((cityData) => {
      if (isCancelled()) return;

      results[index] = cityData;
      loaded += 1;
      hasData ||= cityData.length > 0;

      const timeline = assembleTimeline(results.map((result) => result ?? createEmptyTimeline()));
      if (timeline.length > 0) onTimeline(timeline);
      if (loaded === route.length) onComplete(hasData);
    });
  });
}

function preloadInactiveEntries(dateSlots: DateSlot[]): void {
  for (const slot of dateSlots) {
    for (let i = 0; i < slot.entries.length; i += 1) {
      if (i === slot.activeIndex) continue;

      const entry = slot.entries[i];
      if (!entry) continue;

      const alt = { ...entry, date: slot.date };
      void fetchCityDataForDate(alt).catch((error: unknown) => {
        console.warn('Inactive route preload failed:', error);
      });
    }
  }
}

function buildSwitchInfo(dateSlots: DateSlot[] | null): SwitchInfo {
  const info: SwitchInfo = {};
  if (!dateSlots) return info;

  for (const slot of dateSlots) {
    if (slot.entries.length > 1) {
      const activeEntry = slot.entries[slot.activeIndex];
      if (activeEntry?.originalName) info[activeEntry.originalName] = slot;
    }
  }

  return info;
}

export function useDashboardData(testData?: WeatherTimeline): DashboardDataResult {
  const [state, dispatch] = useReducer(dashboardDataReducer, testData, createInitialState);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const switchRequestRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      switchRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (testData) {
      dispatch({ type: 'test-data-loaded', data: testData });
      return undefined;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;
    const isRefresh = refreshNonce > 0;

    dispatch({ type: isRefresh ? 'refresh-started' : 'load-started' });

    async function loadDashboardData(): Promise<void> {
      try {
        const switchable = await parseSwitchableRoute();
        if (isCancelled()) return;

        if (switchable) {
          const activeRoute = buildRouteForSelections(switchable.dateSlots);

          if (isRefresh) {
            const timeline = await fetchCompleteTimeline(activeRoute);
            if (isCancelled()) return;

            dispatch({
              type: 'refresh-completed',
              data: timeline,
              dateSlots: switchable.dateSlots,
              updatedAt: Date.now(),
            });
            preloadInactiveEntries(switchable.dateSlots);
            return;
          }

          dispatch({ type: 'date-slots-loaded', dateSlots: switchable.dateSlots });

          streamTimeline(activeRoute, {
            isCancelled,
            onTimeline: (timeline) => dispatch({ type: 'timeline-updated', data: timeline }),
            onComplete: (hasData) => {
              if (hasData) {
                dispatch({ type: 'loading-completed', updatedAt: Date.now() });
                preloadInactiveEntries(switchable.dateSlots);
              } else {
                dispatch({ type: 'loading-failed' });
              }
            },
          });
          return;
        }

        const route = await parseRoute();
        if (isCancelled()) return;

        if (isRefresh) {
          const timeline = await fetchCompleteTimeline(route);
          if (isCancelled()) return;

          dispatch({
            type: 'refresh-completed',
            data: timeline,
            dateSlots: null,
            updatedAt: Date.now(),
          });
          return;
        }

        streamTimeline(route, {
          isCancelled,
          onTimeline: (timeline) => dispatch({ type: 'timeline-updated', data: timeline }),
          onComplete: (hasData) =>
            dispatch(
              hasData
                ? { type: 'loading-completed', updatedAt: Date.now() }
                : { type: 'loading-failed' },
            ),
        });
      } catch (error) {
        if (isCancelled()) return;

        console.error(error);
        dispatch(
          isRefresh
            ? { type: 'refresh-failed', message: '自动更新失败，继续显示上次数据' }
            : { type: 'loading-failed' },
        );
      }
    }

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [refreshNonce, testData]);

  const switchInfo = useMemo(() => buildSwitchInfo(state.dateSlots), [state.dateSlots]);
  const refresh = useCallback(() => {
    if (!state.refreshing && !state.switching) setRefreshNonce((nonce) => nonce + 1);
  }, [state.refreshing, state.switching]);

  const handleCityClick = useCallback(
    (cityName: string) => {
      if (state.refreshing || state.switching || !state.dateSlots) return;

      const slot = state.dateSlots.find((s) => s.entries[s.activeIndex]?.originalName === cityName);
      if (!slot || slot.entries.length <= 1) return;

      const newSlots = state.dateSlots.map((s) => {
        if (s === slot) {
          return { ...s, activeIndex: (s.activeIndex + 1) % s.entries.length };
        }
        return s;
      });

      const requestId = switchRequestRef.current + 1;
      switchRequestRef.current = requestId;
      dispatch({ type: 'switch-started', dateSlots: newSlots });

      const route = buildRouteForSelections(newSlots);

      void Promise.all(route.map(fetchCityDataSafely))
        .then((results) => {
          if (!mountedRef.current || switchRequestRef.current !== requestId) return;

          dispatch({
            type: 'switch-completed',
            data: assembleTimeline(results),
            updatedAt: Date.now(),
          });
        })
        .catch((error: unknown) => {
          if (!mountedRef.current || switchRequestRef.current !== requestId) return;

          console.error(error);
          dispatch({ type: 'switch-failed' });
        });
    },
    [state.dateSlots, state.refreshing, state.switching],
  );

  return {
    data: state.data,
    loadingDone: state.loadingDone,
    switching: state.switching,
    lastUpdatedAt: state.lastUpdatedAt,
    refreshing: state.refreshing,
    refreshError: state.refreshError,
    refresh,
    switchInfo,
    handleCityClick,
  };
}
