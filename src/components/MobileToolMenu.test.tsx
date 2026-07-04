import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileToolMenu from './MobileToolMenu';

function renderMenu(overrides: Partial<Parameters<typeof MobileToolMenu>[0]> = {}) {
  const props = {
    themeMode: 'auto' as const,
    effectiveTheme: 'dark' as const,
    onThemeToggle: vi.fn(),
    compactMode: false,
    onCompactToggle: vi.fn(),
    timeStepHours: 1 as const,
    onTimeCompactToggle: vi.fn(),
    onOpenRouteEditor: vi.fn(),
    onEnterCaptureMode: vi.fn(),
    captureDisabled: false,
    ...overrides,
  };

  render(<MobileToolMenu {...props} />);
  return props;
}

describe('MobileToolMenu', () => {
  it('opens a menu of tool actions and closes after running an action', () => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: '打开工具菜单' }));

    expect(screen.getByRole('menu', { name: '工具' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '自动主题 (dark)' }));

    expect(props.onThemeToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: '工具' })).not.toBeInTheDocument();
  });

  it('supports Escape to close the open menu', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: '打开工具菜单' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: '工具' })).not.toBeInTheDocument();
  });

  it('keeps capture action disabled when there is no data', () => {
    renderMenu({ captureDisabled: true });

    fireEvent.click(screen.getByRole('button', { name: '打开工具菜单' }));

    expect(screen.getByRole('menuitem', { name: '进入截图模式' })).toBeDisabled();
  });
});
