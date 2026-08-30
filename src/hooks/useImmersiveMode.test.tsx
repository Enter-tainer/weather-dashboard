import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useImmersiveMode } from './useImmersiveMode';

function ImmersiveModeProbe() {
  const { immersiveMode, setImmersiveMode } = useImmersiveMode();

  return (
    <div>
      <output aria-label="immersive-mode">{String(immersiveMode)}</output>
      <button type="button" onClick={() => setImmersiveMode(!immersiveMode)}>
        toggle
      </button>
    </div>
  );
}

describe('useImmersiveMode', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each(['1', 'true', 'yes', 'on'])('treats immersive=%s as enabled', (value) => {
    window.history.replaceState({}, '', `/?immersive=${value}`);
    render(<ImmersiveModeProbe />);

    expect(screen.getByLabelText('immersive-mode')).toHaveTextContent('true');
  });

  it('writes and removes immersive=true without changing other parameters', () => {
    window.history.replaceState({}, '', '/?display=eink');
    render(<ImmersiveModeProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(window.location.search).toBe('?display=eink&immersive=true');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(window.location.search).toBe('?display=eink');
  });
});
