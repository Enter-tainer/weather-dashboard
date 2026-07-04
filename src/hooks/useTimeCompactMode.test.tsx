import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTimeCompactMode } from './useTimeCompactMode';

function TimeCompactModeProbe() {
  const { timeStepHours, toggleTimeCompactMode } = useTimeCompactMode();

  return (
    <div>
      <output aria-label="time-step">{timeStepHours}</output>
      <button type="button" onClick={toggleTimeCompactMode}>
        toggle
      </button>
    </div>
  );
}

describe('useTimeCompactMode', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each([
    ['3', '3'],
    ['6', '6'],
    ['2', '1'],
    ['', '1'],
  ])('parses timeCompact=%s as %s-hour columns', (param, expected) => {
    window.history.replaceState({}, '', param ? `/?timeCompact=${param}` : '/');

    render(<TimeCompactModeProbe />);

    expect(screen.getByLabelText('time-step')).toHaveTextContent(expected);
  });

  it('cycles 1 -> 3 -> 6 -> 1 through the URL param', () => {
    render(<TimeCompactModeProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByLabelText('time-step')).toHaveTextContent('3');
    expect(window.location.search).toBe('?timeCompact=3');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByLabelText('time-step')).toHaveTextContent('6');
    expect(window.location.search).toBe('?timeCompact=6');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByLabelText('time-step')).toHaveTextContent('1');
    expect(window.location.search).toBe('');
  });
});
