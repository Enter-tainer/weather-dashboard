import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { fetchCityDataForDate, assembleTimeline } from '../services/api';
import { parseRoute, parseSwitchableRoute, buildRouteForSelections } from '../services/urlParser';
import type { DateSlot, RouteEntry, WeatherTimeline } from '../types/weather';

export type SwitchInfo = Record<string, DateSlot>;

interface DashboardDataState {
  data: WeatherTimeline | null;
  loadingDone: boolean;
  dateSlots: DateSlot[] | null;
  switching: boolean;
}

type DashboardDataAction =
  | { type: 'test-data-loaded'; data: WeatherTimeline }
  | { type: 'load-started' }
  | { type: 'timeline-updated'; data: WeatherTimeline }
  | { type: 'loading-completed' }
  | { type: 'date-slots-loaded'; dateSlots: DateSlot[] }
  | { type: 'switch-started'; dateSlots: DateSlot[] }
  | { type: 'switch-completed'; data: WeatherTimeline }
  | { type: 'switch-failed' };

interface StreamTimelineOptions {
  isCancelled: () => boolean;
  onTimeline: (timeline: WeatherTimeline) => void;
  onComplete: () => void;
}

export interface DashboardDataResult {
  data: WeatherTimeline | null;
  loadingDone: boolean;
  switching: boolean;
  switchInfo: SwitchInfo;
  handleCityClick: (cityName: string) => void;
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

    case 'timeline-updated':
      return { ...state, data: action.data };

    case 'loading-completed':
      return { ...state, loadingDone: true };

    case 'date-slots-loaded':
      return { ...state, dateSlots: action.dateSlots };

    case 'switch-started':
      return { ...state, dateSlots: action.dateSlots, switching: true };

    case 'switch-completed':
      return { ...state, data: action.data, switching: false };

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

function streamTimeline(
  route: RouteEntry[],
  { isCancelled, onTimeline, onComplete }: StreamTimelineOptions,
): void {
  if (route.length === 0) {
    if (!isCancelled()) onComplete();
    return;
  }

  const results = Array.from({ length: route.length }, (): WeatherTimeline | null => null);
  let loaded = 0;

  route.forEach((entry, index) => {
    void fetchCityDataSafely(entry).then((cityData) => {
      if (isCancelled()) return;

      results[index] = cityData;
      loaded += 1;

      const timeline = assembleTimeline(results.map((result) => result ?? createEmptyTimeline()));
      if (timeline.length > 0) onTimeline(timeline);
      if (loaded === route.length) onComplete();
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

    dispatch({ type: 'load-started' });

    async function loadDashboardData(): Promise<void> {
      try {
        const switchable = await parseSwitchableRoute();
        if (isCancelled()) return;

        if (switchable) {
          dispatch({ type: 'date-slots-loaded', dateSlots: switchable.dateSlots });
          const activeRoute = buildRouteForSelections(switchable.dateSlots);

          streamTimeline(activeRoute, {
            isCancelled,
            onTimeline: (timeline) => dispatch({ type: 'timeline-updated', data: timeline }),
            onComplete: () => {
              dispatch({ type: 'loading-completed' });
              preloadInactiveEntries(switchable.dateSlots);
            },
          });
          return;
        }

        const route = await parseRoute();
        if (isCancelled()) return;

        streamTimeline(route, {
          isCancelled,
          onTimeline: (timeline) => dispatch({ type: 'timeline-updated', data: timeline }),
          onComplete: () => dispatch({ type: 'loading-completed' }),
        });
      } catch (error) {
        if (isCancelled()) return;

        console.error(error);
        dispatch({ type: 'loading-completed' });
      }
    }

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [testData]);

  const switchInfo = useMemo(() => buildSwitchInfo(state.dateSlots), [state.dateSlots]);

  const handleCityClick = useCallback(
    (cityName: string) => {
      if (state.switching || !state.dateSlots) return;

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
          });
        })
        .catch((error: unknown) => {
          if (!mountedRef.current || switchRequestRef.current !== requestId) return;

          console.error(error);
          dispatch({ type: 'switch-failed' });
        });
    },
    [state.dateSlots, state.switching],
  );

  return {
    data: state.data,
    loadingDone: state.loadingDone,
    switching: state.switching,
    switchInfo,
    handleCityClick,
  };
}
