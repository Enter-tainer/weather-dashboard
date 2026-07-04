import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeMode } from './useThemeMode';

const THEME_STORAGE_KEY = 'weather-dashboard-theme';

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ThemeModeProbe() {
  const { mode, effectiveTheme, cycleThemeMode } = useThemeMode();

  return (
    <div>
      <output aria-label="mode">{mode}</output>
      <output aria-label="effective-theme">{effectiveTheme}</output>
      <button type="button" onClick={cycleThemeMode}>
        cycle
      </button>
    </div>
  );
}

describe('useThemeMode', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    installMatchMedia(true);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
    document.documentElement.style.colorScheme = '';
    vi.restoreAllMocks();
  });

  it('prefers the theme query param over stored mode', async () => {
    window.history.replaceState({}, '', '/?theme=dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    render(<ThemeModeProbe />);

    expect(screen.getByLabelText('mode')).toHaveTextContent('dark');
    expect(screen.getByLabelText('effective-theme')).toHaveTextContent('dark');
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });
  });

  it('cycles auto, light, dark, and back to auto', async () => {
    render(<ThemeModeProbe />);

    expect(screen.getByLabelText('mode')).toHaveTextContent('auto');
    expect(screen.getByLabelText('effective-theme')).toHaveTextContent('dark');

    fireEvent.click(screen.getByRole('button', { name: 'cycle' }));
    expect(screen.getByLabelText('mode')).toHaveTextContent('light');
    expect(screen.getByLabelText('effective-theme')).toHaveTextContent('light');

    fireEvent.click(screen.getByRole('button', { name: 'cycle' }));
    expect(screen.getByLabelText('mode')).toHaveTextContent('dark');
    expect(screen.getByLabelText('effective-theme')).toHaveTextContent('dark');

    fireEvent.click(screen.getByRole('button', { name: 'cycle' }));
    expect(screen.getByLabelText('mode')).toHaveTextContent('auto');
    expect(screen.getByLabelText('effective-theme')).toHaveTextContent('dark');

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto');
      expect(document.documentElement.dataset.themeMode).toBe('auto');
    });
  });
});
