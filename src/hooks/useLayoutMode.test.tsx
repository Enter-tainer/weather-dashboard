import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLayoutMode, useLayoutMode } from './useLayoutMode';

function LayoutModeProbe() {
  return (
    <>
      <output aria-label="layout-mode">{useLayoutMode()}</output>
      <button type="button" onClick={() => setLayoutMode('reader')}>
        enable reader
      </button>
      <button type="button" onClick={() => setLayoutMode('standard')}>
        disable reader
      </button>
    </>
  );
}

describe('useLayoutMode', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.documentElement.removeAttribute('data-layout');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-layout');
  });

  it('defaults to standard and ignores unknown values', async () => {
    window.history.replaceState({}, '', '/?layout=poster');
    render(<LayoutModeProbe />);

    expect(screen.getByLabelText('layout-mode')).toHaveTextContent('standard');
    await waitFor(() => expect(document.documentElement.dataset.layout).toBe('standard'));
  });

  it('activates the reader layout without changing other parameters', async () => {
    window.history.replaceState({}, '', '/?display=eink&layout=reader&immersive=true');
    render(<LayoutModeProbe />);

    expect(screen.getByLabelText('layout-mode')).toHaveTextContent('reader');
    expect(window.location.search).toBe('?display=eink&layout=reader&immersive=true');
    await waitFor(() => expect(document.documentElement.dataset.layout).toBe('reader'));
  });

  it('updates the layout parameter while preserving unrelated settings', async () => {
    window.history.replaceState({}, '', '/?display=eink&immersive=true');
    render(<LayoutModeProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'enable reader' }));
    expect(window.location.search).toBe('?display=eink&immersive=true&layout=reader');
    await waitFor(() => expect(screen.getByLabelText('layout-mode')).toHaveTextContent('reader'));

    fireEvent.click(screen.getByRole('button', { name: 'disable reader' }));
    expect(window.location.search).toBe('?display=eink&immersive=true');
  });
});
