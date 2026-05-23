import { useCallback, useEffect, useMemo, useState } from 'react';

export const THEME_MODES = ['auto', 'light', 'dark'];
const THEME_STORAGE_KEY = 'weather-dashboard-theme';

function isThemeMode(value) {
  return THEME_MODES.includes(value);
}

function getStoredMode() {
  const queryMode = new URLSearchParams(window.location.search).get('theme');
  if (isThemeMode(queryMode)) return queryMode;

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function getSystemTheme() {
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemeMode() {
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
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
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
      return THEME_MODES[(currentIndex + 1) % THEME_MODES.length];
    });
  }, []);

  return { mode, effectiveTheme, cycleThemeMode };
}
