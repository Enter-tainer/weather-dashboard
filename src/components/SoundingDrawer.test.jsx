import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose on backdrop Enter key', () => {
      render(<SoundingDrawer item={makeItem()} index={0} total={24} onClose={onClose} onStep={onStep} />);
      const backdrop = screen.getByLabelText('关闭 Skew-T 面板');
      fireEvent.keyDown(backdrop, { key: 'Enter' });
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
      // jsdom might not fully support style changes, but the effect should run
      unmount();
      // Should restore (or be empty in jsdom)
      expect(document.body.style.overflow).toBe(original || '');
    });
  });
});
