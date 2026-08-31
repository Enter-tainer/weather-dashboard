import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { DashboardLayoutContext } from './dashboardLayoutContext';
import {
  dashboardLayoutCssVariables,
  getDashboardLayoutMetrics,
  type DashboardLayoutMode,
  type DashboardOrientation,
} from '../services/dashboardLayout';

const noop = (): void => undefined;

function currentOrientation(): DashboardOrientation {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

function subscribeToViewport(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return noop;
  window.addEventListener('resize', onStoreChange);
  window.addEventListener('orientationchange', onStoreChange);
  return () => {
    window.removeEventListener('resize', onStoreChange);
    window.removeEventListener('orientationchange', onStoreChange);
  };
}

export default function DashboardLayoutProvider({
  layoutMode,
  children,
}: PropsWithChildren<{ layoutMode: DashboardLayoutMode }>) {
  const orientation = useSyncExternalStore(
    subscribeToViewport,
    currentOrientation,
    () => 'landscape' as const,
  );
  const metrics = useMemo(
    () => getDashboardLayoutMetrics(layoutMode, orientation),
    [layoutMode, orientation],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    const variables = dashboardLayoutCssVariables(metrics);
    root.dataset.layout = layoutMode;
    root.dataset.layoutOrientation = orientation;
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    window.dispatchEvent(new CustomEvent('weather-dashboard-layout-change', { detail: metrics }));

    return () => {
      for (const name of Object.keys(variables)) root.style.removeProperty(name);
      delete root.dataset.layoutOrientation;
    };
  }, [layoutMode, metrics, orientation]);

  return (
    <DashboardLayoutContext.Provider value={metrics}>{children}</DashboardLayoutContext.Provider>
  );
}
