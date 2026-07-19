import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeWeatherPoint } from '../test-utils/weather';
import type { WeatherPoint } from '../types/weather';
import type { SunDirectionInfo } from '../services/sunDirection';
import type { SunCloudSectionState } from '../hooks/useSunCloudSection';
import type { CanvasDraw } from '../hooks/useCanvas';
import SunDirectionCloudDrawer from './SunDirectionCloudDrawer';

const { useCanvasMock } = vi.hoisted(() => ({
  useCanvasMock: vi.fn((...args: unknown[]) => {
    void args;
    return { current: null };
  }),
}));

vi.mock('../hooks/useCanvas', () => ({
  useCanvas: useCanvasMock,
}));

function makeCanvasContext(): {
  ctx: CanvasRenderingContext2D;
  fillRect: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
} {
  const fillRect = vi.fn();
  const arc = vi.fn();
  const properties: Record<PropertyKey, unknown> = { fillRect, arc };
  const ctx = new Proxy(properties, {
    get(target, property) {
      if (!(property in target)) target[property] = vi.fn();
      return target[property];
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fillRect, arc };
}

function makeOrigin(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return makeWeatherPoint({
    cityName: 'Beijing',
    latitude: 39.9,
    longitude: 116.4,
    hour: 19,
    ...overrides,
  });
}

const DIRECTION: SunDirectionInfo = {
  eventType: 'sunset',
  eventTrueMs: Date.parse('2026-07-15T11:43:40Z'),
  bearingDeg: 300,
  altitudeDeg: -0.8,
};

describe('SunDirectionCloudDrawer', () => {
  let onClose: () => void;
  const successState: SunCloudSectionState = {
    status: 'success',
    data: {
      origin: { lat: 39.9, lon: 116.4 },
      eventType: 'sunset',
      eventTrueMs: 0,
      bearingDeg: 300,
      altitudeDeg: -0.8,
      columns: [
        {
          lat: 39.9,
          lon: 116.4,
          distanceKm: 0,
          cloudByLevel: undefined,
          cloudLow: 5,
          cloudMid: 0,
          cloudHigh: 0,
        },
        {
          lat: 40,
          lon: 117,
          distanceKm: 45,
          cloudByLevel: undefined,
          cloudLow: 5,
          cloudMid: 60,
          cloudHigh: 0,
        },
      ],
    },
    error: null,
  };

  beforeEach(() => {
    onClose = vi.fn();
    useCanvasMock.mockClear();
  });

  it('gives useCanvas the real renderer used by resize redraws', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );

    const paint = useCanvasMock.mock.calls.at(-1)?.[2] as CanvasDraw | undefined;
    expect(paint).toBeTypeOf('function');
    const { ctx, fillRect, arc } = makeCanvasContext();
    paint?.(ctx, 540, 410);
    expect(fillRect).toHaveBeenCalled();
    expect(arc).toHaveBeenCalled();
  });

  it('renders the heading with city, bearing, and altitude', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('日落方向云况剖面')).toBeTruthy();
    expect(screen.getByText(/Beijing/)).toBeTruthy();
    expect(screen.getByText(/方位 300°/)).toBeTruthy();
    expect(screen.getByText(/太阳高度 -0.8°/)).toBeTruthy();
  });

  it('calls onClose on the X button', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    const backdrop = document.querySelector('.sun-cloud-backdrop') as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on a click inside the drawer', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText('朝日方向云况剖面'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a loading state', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={{ status: 'loading', data: null, error: null }}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('正在加载朝日方向云况…')).toBeTruthy();
  });

  it('shows an error state', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={{ status: 'error', data: null, error: '加载失败' }}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('加载失败')).toBeTruthy();
  });

  it('locks body scroll on mount and restores on unmount', () => {
    const original = document.body.style.overflow;
    const { unmount } = render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe(original || '');
  });
});
