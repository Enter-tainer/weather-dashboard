import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCompactMode } from './useCompactMode';

function CompactModeProbe() {
  const { compactMode, toggleCompactMode } = useCompactMode();

  return (
    <div>
      <output aria-label="compact-mode">{String(compactMode)}</output>
      <button type="button" onClick={toggleCompactMode}>
        toggle
      </button>
    </div>
  );
}

describe('useCompactMode', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each(['1', 'true', 'yes', 'on'])('treats compact=%s as enabled', (value) => {
    window.history.replaceState({}, '', `/?compact=${value}`);

    render(<CompactModeProbe />);

    expect(screen.getByLabelText('compact-mode')).toHaveTextContent('true');
  });

  it('toggles compact mode through the URL param', () => {
    render(<CompactModeProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByLabelText('compact-mode')).toHaveTextContent('true');
    expect(window.location.search).toBe('?compact=1');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByLabelText('compact-mode')).toHaveTextContent('false');
    expect(window.location.search).toBe('');
  });
});
