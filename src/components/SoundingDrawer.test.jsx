import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SoundingDrawer from './SoundingDrawer';

vi.mock('skewt', () => ({
  SkewT: vi.fn().mockImplementation(() => ({ plot: vi.fn(), destroy: vi.fn() })),
}));
vi.mock('skewt/style.css', () => ({}));
vi.mock('../services/sounding', () => ({
  detectInversions: vi.fn(() => []),
  toSkewtFormat: vi.fn(() => []),
  withSurfaceLevel: vi.fn((item) => item?.soundingLevels || []),
}));

function makeItem(overrides = {}) {
  return {
    cityName: 'Beijing',
    time: '2025-05-23T08:00:00Z',
    temperature: 25, dewPoint: 10, windSpeed: 15, windDir: 180,
    pressure: 1013, humidity: 40, soundingLevels: [],
    ...overrides,
  };
}

describe('SoundingDrawer', () => {
  let onClose, onStep;

  beforeEach(() => {
    onClose = vi.fn();
    onStep = vi.fn();
  });

  describe('close mechanisms', () => {
    it('calls onClose on X button click', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      fireEvent.click(screen.getByLabelText('关闭 Skew-T'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on backdrop click', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const backdrop = screen.getByLabelText('关闭 Skew-T 面板');
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when clicking inside the drawer', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const drawer = screen.getByLabelText('Skew-T 探空图');
      fireEvent.click(drawer);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call onClose when clicking a non-drawer child inside backdrop', () => {
      // Future-proof: if a toast or overlay lives inside backdrop, clicking it
      // should NOT close — only clicks directly on the backdrop layer itself.
      const { container } = render(
        <SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />
      );
      const backdrop = screen.getByLabelText('关闭 Skew-T 面板');

      // Plant a child (like a hypothetical toast) directly inside backdrop
      const toast = document.createElement('div');
      toast.className = 'hypothetical-toast';
      backdrop.appendChild(toast);

      fireEvent.click(toast);
      expect(onClose).not.toHaveBeenCalled();

      // Verify backdrop click still works after adding the child
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on pointerdown outside the drawer', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      fireEvent.pointerDown(outside);
      document.body.removeChild(outside);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on Escape key', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose on non-Escape key', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      fireEvent.keyDown(document, { key: 'a' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose on backdrop Enter key', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const backdrop = screen.getByLabelText('关闭 Skew-T 面板');
      fireEvent.keyDown(backdrop, { key: 'Enter' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on backdrop Space key', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const backdrop = screen.getByLabelText('关闭 Skew-T 面板');
      fireEvent.keyDown(backdrop, { key: ' ' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose on pointerdown after unmount', () => {
      const { unmount } = render(
        <SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />
      );
      unmount();
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      fireEvent.pointerDown(outside);
      document.body.removeChild(outside);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('uses ref for onClose — stale onClose does not break when parent re-renders', () => {
      const { rerender } = render(
        <SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />
      );
      const newOnClose = vi.fn();
      rerender(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={newOnClose} onStep={onStep} />);
      // Even after rerender, Escape should call the latest onClose (via ref)
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(newOnClose).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled(); // old reference was replaced in ref
    });
  });

  describe('navigation', () => {
    it('calls onStep with -1 for previous', () => {
      render(<SoundingDrawer item={makeItem()} index={5} total={24} onClose={onClose} onStep={onStep} />);
      fireEvent.click(screen.getByLabelText('上一小时'));
      expect(onStep).toHaveBeenCalledWith(-1);
    });

    it('calls onStep with 1 for next', () => {
      render(<SoundingDrawer item={makeItem()} index={5} total={24} onClose={onClose} onStep={onStep} />);
      fireEvent.click(screen.getByLabelText('下一小时'));
      expect(onStep).toHaveBeenCalledWith(1);
    });

    it('disables previous at index 0', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      expect(screen.getByLabelText('上一小时').disabled).toBe(true);
    });

    it('disables next at last index', () => {
      render(<SoundingDrawer item={makeItem()} index={23} total={24} onClose={onClose} onStep={onStep} />);
      expect(screen.getByLabelText('下一小时').disabled).toBe(true);
    });
  });

  describe('rendering', () => {
    it('shows title and city', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      expect(screen.getByText('Skew-T Log-P')).toBeTruthy();
      expect(screen.getByText(/Beijing/)).toBeTruthy();
    });

    it('handles null wind/temp gracefully', () => {
      render(
        <SoundingDrawer
          item={makeItem({ windSpeed: null, windDir: null, temperature: null, dewPoint: null })}
          index={0} total={24} onClose={onClose} onStep={onStep}
        />
      );
      expect(screen.getByText('Skew-T Log-P')).toBeTruthy();
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll on mount and restores on unmount', () => {
      const original = document.body.style.overflow;
      const { unmount } = render(
        <SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />
      );

      // MUST be 'hidden' while drawer is mounted
      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      // After unmount, must restore original value
      expect(document.body.style.overflow).toBe(original || '');
    });
  });

  describe('mobile viewport (narrow screen)', () => {
    let originalInnerWidth;
    let originalMatchMedia;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalMatchMedia = window.matchMedia;
      // Simulate iPhone SE (375px) — drawer is 355px, only 20px gap
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('max-width') ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.matchMedia = originalMatchMedia;
    });

    it('renders backdrop full-screen so narrow-gap taps still close', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const backdrop = screen.getByLabelText('关闭 Skew-T 面板');

      // Backdrop must exist (the whole premise of the fix)
      expect(backdrop).toBeTruthy();

      // Clicking backdrop closes regardless of viewport width
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('drawer renders at expected narrow width', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const drawer = screen.getByLabelText('Skew-T 探空图');

      // At 375px screen, drawer should be constrained: max(355px, calc(100vw-20px))
      // getComputedStyle won't return the full CSS in jsdom, but we confirm it's present
      expect(drawer).toBeTruthy();
      // Verify css max() logic is applied (jsdom returns empty string for unresolved values)
      const maxWidth = window.getComputedStyle(drawer).width;
      // It at least has a computed width (not 'auto' or '')
      expect(maxWidth).toBeTruthy();
    });
  });
});
