import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CompactToggle from './CompactToggle';
import ThemeToggle from './ThemeToggle';
import TimeCompactToggle from './TimeCompactToggle';

describe('toggle button components', () => {
  it('exposes compact mode actions with accessible names', () => {
    const onToggle = vi.fn();

    const { rerender } = render(<CompactToggle compactMode={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: '切换到紧凑视图' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<CompactToggle compactMode onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: '切换到完整视图' })).toBeInTheDocument();
  });

  it('labels each time compact step by the next action', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<TimeCompactToggle timeStepHours={1} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: '切换到 3 小时一格' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<TimeCompactToggle timeStepHours={3} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: '切换到 6 小时一格' })).toBeInTheDocument();

    rerender(<TimeCompactToggle timeStepHours={6} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: '切换到每小时一格' })).toBeInTheDocument();
  });

  it('labels theme mode and next theme action', () => {
    const onToggle = vi.fn();

    render(<ThemeToggle mode="auto" effectiveTheme="dark" onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: '主题：自动 (dark)。点击切换到亮色' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
