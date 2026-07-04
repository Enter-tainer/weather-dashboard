import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { DashboardScales, WeatherTimeline } from '../types/weather';
import DashboardLanes, { DashboardLaneStack } from './DashboardLanes';

vi.mock('../hooks/useCanvas', () => ({
  useCanvas: () => ({ current: null }),
}));

const SCALES: DashboardScales = {
  minTemp: 0,
  maxTemp: 30,
  minP: 1000,
  maxP: 1020,
  maxBft: 6,
  tempSteps: [0, 10, 20, 30],
};

function makeTimeline(length = 6): WeatherTimeline {
  return makeWeatherTimeline(
    Array.from({ length }, (_, index) =>
      makeWeatherPoint({
        time: `2026-05-23T${String(index).padStart(2, '0')}:00:00`,
        hour: index,
        temperature: 20 + index,
        apparentTemp: 19 + index,
      }),
    ),
  );
}

describe('DashboardLanes', () => {
  it('shows loading and empty states for missing data', () => {
    const { container, rerender } = render(
      <DashboardLanes
        data={null}
        loadingDone={false}
        switching={false}
        switchInfo={{}}
        onCityClick={vi.fn()}
        compactMode={false}
        scales={SCALES}
      />,
    );

    expect(container.querySelector('.loading-spinner')).toBeInTheDocument();

    rerender(
      <DashboardLanes
        data={makeWeatherTimeline()}
        loadingDone
        switching={false}
        switchInfo={{}}
        onCityClick={vi.fn()}
        compactMode={false}
        scales={SCALES}
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders capture overlay with the selected duration', () => {
    render(
      <DashboardLanes
        data={makeTimeline(8)}
        loadingDone
        switching={false}
        switchInfo={{}}
        onCityClick={vi.fn()}
        compactMode={false}
        hoursPerColumn={3}
        scales={SCALES}
        captureMode
        captureSelection={{ startIndex: 1, endIndex: 3 }}
        onCaptureSelectionChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('截图时间范围')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动截图时间范围' })).toHaveTextContent('6h');
  });
});

describe('DashboardLaneStack', () => {
  it('shows an ensemble fallback status notice when any point uses ensemble data', () => {
    render(
      <DashboardLaneStack
        data={makeWeatherTimeline([makeWeatherPoint({ dataSource: 'ensemble' })])}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Forecast 不可用，正在使用 ensemble 近似');
  });

  it('switches full cloud lanes to compact temperature text lanes', () => {
    const data = makeTimeline();
    const { container, rerender } = render(
      <DashboardLaneStack data={data} compactMode={false} scales={SCALES} switchInfo={{}} />,
    );

    expect(container.querySelector('.cloud-sounding-region')).toBeInTheDocument();
    expect(container.querySelector('.temp-text-lane')).not.toBeInTheDocument();

    rerender(<DashboardLaneStack data={data} compactMode scales={SCALES} switchInfo={{}} />);

    expect(container.querySelector('.cloud-sounding-region')).not.toBeInTheDocument();
    expect(container.querySelector('.temp-text-lane')).toBeInTheDocument();
  });
});
