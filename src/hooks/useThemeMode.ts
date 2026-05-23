import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSearchParam } from '../services/urlState';

export const THEME_MODES = ['auto', 'light', 'dark'] as const;
export type ThemeMode = typeof THEME_MODES[number];
export type EffectiveTheme = Exclude<ThemeMode, 'auto'>;

const THEME_STORAGE_KEY = 'weather-dashboard-theme';

interface ThemeModeResult {
  mode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  cycleThemeMode: () => void;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

function getStoredMode(): ThemeMode {
  const queryMode = getSearchParam('theme');
  if (isThemeMode(queryMode)) return queryMode;

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function getSystemTheme(): EffectiveTheme {
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemeMode(): ThemeModeResult {
  const [mode, setMode] = useState(getStoredMode);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const effectiveTheme = useMemo(
    () => (mode === 'auto' ? systemTheme : mode),
    [mode, systemTheme],
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(media.matches ? 'dark' : 'light');

    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.style.colorScheme = effectiveTheme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore private browsing or blocked storage.
    }

    window.dispatchEvent(new CustomEvent('weather-theme-change', {
      detail: { mode, effectiveTheme },
    }));
  }, [mode, effectiveTheme]);

  const cycleThemeMode = useCallback(() => {
    setMode(current => {
      const currentIndex = THEME_MODES.indexOf(current);
      return THEME_MODES[(currentIndex + 1) % THEME_MODES.length] ?? 'auto';
    });
  }, []);

  return { mode, effectiveTheme, cycleThemeMode };
}
