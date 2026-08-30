import { useLayoutEffect } from 'react';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

export const DISPLAY_MODES = ['color', 'eink'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

function parseDisplayMode(value: string | null): DisplayMode {
  return value?.toLowerCase() === 'eink' ? 'eink' : 'color';
}

export function setDisplayMode(displayMode: DisplayMode): void {
  setSearchParam('display', displayMode === 'eink' ? 'eink' : null);
}

/**
 * Presentation mode is intentionally separate from the light/dark theme.
 * E-ink is a rendering profile: it changes fills, patterns and motion policy,
 * while the underlying weather data and layout remain the same.
 */
export function useDisplayMode(): DisplayMode {
  const displayParam = useSearchParam('display');
  const displayMode = parseDisplayMode(displayParam);

  useLayoutEffect(() => {
    document.documentElement.dataset.display = displayMode;
    window.dispatchEvent(
      new CustomEvent('weather-render-profile-change', {
        detail: { displayMode },
      }),
    );
  }, [displayMode]);

  return displayMode;
}
