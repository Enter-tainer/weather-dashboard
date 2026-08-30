import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { setDisplayMode, useDisplayMode } from './useDisplayMode';

function DisplayModeProbe() {
  return (
    <div>
      <output aria-label="display-mode">{useDisplayMode()}</output>
      <button type="button" onClick={() => setDisplayMode('eink')}>
        enable eink
      </button>
      <button type="button" onClick={() => setDisplayMode('color')}>
        disable eink
      </button>
    </div>
  );
}

describe('useDisplayMode', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.documentElement.removeAttribute('data-display');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-display');
  });

  it('defaults to color and ignores unknown display values', async () => {
    window.history.replaceState({}, '', '/?display=terminal');
    render(<DisplayModeProbe />);

    expect(screen.getByLabelText('display-mode')).toHaveTextContent('color');
    await waitFor(() => expect(document.documentElement.dataset.display).toBe('color'));
  });

  it('activates eink without affecting other URL parameters', async () => {
    window.history.replaceState({}, '', '/?route=Shanghai&compact=1&display=eink');
    render(<DisplayModeProbe />);

    expect(screen.getByLabelText('display-mode')).toHaveTextContent('eink');
    expect(window.location.search).toBe('?route=Shanghai&compact=1&display=eink');
    await waitFor(() => expect(document.documentElement.dataset.display).toBe('eink'));
  });

  it('updates the display parameter while preserving unrelated parameters', async () => {
    window.history.replaceState({}, '', '/?route=Shanghai');
    render(<DisplayModeProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'enable eink' }));
    expect(window.location.search).toBe('?route=Shanghai&display=eink');
    await waitFor(() => expect(screen.getByLabelText('display-mode')).toHaveTextContent('eink'));

    fireEvent.click(screen.getByRole('button', { name: 'disable eink' }));
    expect(window.location.search).toBe('?route=Shanghai');
    await waitFor(() => expect(screen.getByLabelText('display-mode')).toHaveTextContent('color'));
  });
});
