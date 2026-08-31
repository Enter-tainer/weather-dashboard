import { useLayoutEffect } from 'react';
import { useSearchParam } from './useSearchParam';
import type { DashboardLayoutMode } from '../services/dashboardLayout';
import { setSearchParam } from '../services/urlState';

function parseLayoutMode(value: string | null): DashboardLayoutMode {
  return value?.toLowerCase() === 'reader' ? 'reader' : 'standard';
}

export function setLayoutMode(layoutMode: DashboardLayoutMode): void {
  setSearchParam('layout', layoutMode === 'reader' ? 'reader' : null);
}

export function useLayoutMode(): DashboardLayoutMode {
  const layoutParam = useSearchParam('layout');
  const layoutMode = parseLayoutMode(layoutParam);

  useLayoutEffect(() => {
    document.documentElement.dataset.layout = layoutMode;
  }, [layoutMode]);

  return layoutMode;
}
