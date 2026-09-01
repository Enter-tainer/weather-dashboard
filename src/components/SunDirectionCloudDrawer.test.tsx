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
  fillText: ReturnType<typeof vi.fn>;
  createLinearGradient: ReturnType<typeof vi.fn>;
  addColorStop: ReturnType<typeof vi.fn>;
} {
  const fillRect = vi.fn();
  const arc = vi.fn();
  const fillText = vi.fn();
  const addColorStop = vi.fn();
  const createLinearGradient = vi.fn(() => ({ addColorStop }));
  const properties: Record<PropertyKey, unknown> = {
    fillRect,
    arc,
    fillText,
    createLinearGradient,
  };
  const ctx = new Proxy(properties, {
    get(target, property) {
      if (!(property in target)) target[property] = vi.fn();
      return target[property];
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fillRect, arc, fillText, createLinearGradient, addColorStop };
}

function makeOrigin(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return makeWeatherPoint({
    cityName: 'Beijing',
    latitude: 39.9,
    longitude: 116.4,
    hour: 19,
    timezone: 'Asia/Shanghai',
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
    const aboveHorizonBackground = fillRect.mock.calls.find(
      ([x, y, width]) => x === 50 && y === 12 && width === 440,
    );
    expect(aboveHorizonBackground).toBeUndefined();
  });

  it('draws the civil-twilight scale beside the time axis without covering the cloud plot', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    const twilightPaint = useCanvasMock.mock.calls.at(-1)?.[2] as CanvasDraw;
    const twilightCanvas = makeCanvasContext();
    twilightPaint(twilightCanvas.ctx, 540, 410);
    expect(twilightCanvas.createLinearGradient).toHaveBeenCalledTimes(1);
    expect(twilightCanvas.addColorStop).toHaveBeenCalledTimes(5);
    const twilightLane = twilightCanvas.fillRect.mock.calls.find(
      ([x, , width]) => x === 38 && width === 6,
    );
    // The +2° endpoint follows the refracted path, about 1 km below its unrefracted tangent at
    // 300 km, while remaining in the plot's top padding/headroom.
    expect(twilightLane?.[1]).toBeLessThan(45);
    expect(Number(twilightLane?.[1]) + Number(twilightLane?.[3])).toBeGreaterThan(650);
    expect(
      twilightCanvas.fillRect.mock.calls.some(
        ([x, , width]) =>
          typeof x === 'number' && typeof width === 'number' && x >= 50 && width > 6,
      ),
    ).toBe(true);
  });

  it('puts sunset on the left and sunrise on the right', () => {
    const sunsetView = render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    const sunsetPaint = useCanvasMock.mock.calls.at(-1)?.[2] as CanvasDraw;
    const sunsetCanvas = makeCanvasContext();
    sunsetPaint(sunsetCanvas.ctx, 540, 410);
    const sunsetDisc = sunsetCanvas.arc.mock.calls.find((call) => call[2] === 7);
    expect(sunsetDisc?.[0]).toBe(50);
    const sunsetStation = sunsetCanvas.fillText.mock.calls.find((call) => call[0] === '本站');
    expect(sunsetStation?.[1]).toBeGreaterThan(490);
    sunsetView.unmount();

    const sunriseDirection: SunDirectionInfo = {
      ...DIRECTION,
      eventType: 'sunrise',
      bearingDeg: 60,
    };
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={sunriseDirection}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    const sunrisePaint = useCanvasMock.mock.calls.at(-1)?.[2] as CanvasDraw;
    const sunriseCanvas = makeCanvasContext();
    sunrisePaint(sunriseCanvas.ctx, 540, 410);
    const sunriseDisc = sunriseCanvas.arc.mock.calls.find((call) => call[2] === 7);
    expect(sunriseDisc?.[0]).toBe(490);
    const sunriseStation = sunriseCanvas.fillText.mock.calls.find((call) => call[0] === '本站');
    expect(sunriseStation?.[1]).toBeLessThan(50);
  });

  it('labels the sun-side axis with the selected time and identifies the earth', () => {
    render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    const paint = useCanvasMock.mock.calls.at(-1)?.[2] as CanvasDraw;
    const { ctx, fillText } = makeCanvasContext();
    paint(ctx, 540, 410);
    expect(fillText.mock.calls.some((call) => call[0] === '19:43')).toBe(true);
    expect(fillText.mock.calls.some((call) => call[0] === '300km')).toBe(false);
    expect(fillText.mock.calls.some((call) => call[0] === '地球')).toBe(true);
    expect(fillText.mock.calls.some((call) => call[0] === '本站')).toBe(true);
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
    expect(screen.getByText(/标准大气折射光路/)).toBeTruthy();
  });

  it('keeps the sun under the pointer and draggable below the cloud frame', () => {
    const { container } = render(
      <SunDirectionCloudDrawer
        origin={makeOrigin()}
        direction={DIRECTION}
        sectionState={successState}
        onClose={onClose}
      />,
    );
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Missing sun cross-section canvas');
    expect(canvas.height).toBeGreaterThan(680);
    expect(canvas.height).toBeLessThan(740);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 540,
      bottom: canvas.height,
      left: 0,
      width: 540,
      height: canvas.height,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { clientY: 500, pointerId: 1 });
    const draggedPaint = useCanvasMock.mock.calls.at(-1)?.[2] as CanvasDraw;
    const draggedCanvas = makeCanvasContext();
    draggedPaint(draggedCanvas.ctx, 540, canvas.height);
    const draggedSun = draggedCanvas.arc.mock.calls.find((call) => call[2] === 7);
    expect(draggedSun?.[1]).toBeCloseTo(500);

    fireEvent.pointerMove(canvas, { clientY: canvas.height, pointerId: 1 });
    expect(screen.getByText(/太阳高度 -6.0°/)).toBeTruthy();
    fireEvent.pointerUp(canvas, { clientY: canvas.height, pointerId: 1 });
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
