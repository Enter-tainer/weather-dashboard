import { fireEvent, render, screen } from '@testing-library/react';
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

  it('aligns the capture selection with an expanded minutely region', () => {
    const data = makeTimeline(4);
    const selectedItem = data[1];
    if (!selectedItem) throw new Error('Missing selected test hour');

    const { container } = render(
      <DashboardLanes
        data={data}
        loadingDone
        switching={false}
        switchInfo={{}}
        onCityClick={vi.fn()}
        compactMode={false}
        scales={SCALES}
        captureMode
        captureSelection={{ startIndex: 1, endIndex: 4 }}
        onCaptureSelectionChange={vi.fn()}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'loading',
          data: null,
          error: null,
        }}
        onMinutelySelect={vi.fn()}
      />,
    );

    expect(container.querySelector('.timeline-capture-selection')).toHaveStyle({
      left: '22px',
      width: '396px',
    });
    expect(container.querySelector('.minutely-rain-inline')).toBeInTheDocument();
  });
});

describe('DashboardLaneStack', () => {
  it('uses the three precipitation cells around now as the minutely click target', () => {
    const onMinutelySelect = vi.fn();
    render(
      <DashboardLaneStack
        data={makeTimeline(4)}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
        minutelyAvailableIndices={new Set([1, 2, 3])}
        onMinutelySelect={onMinutelySelect}
      />,
    );

    const triggers = screen.getAllByRole('button', { name: '展开未来两小时的 5 分钟降水' });
    expect(triggers).toHaveLength(3);
    expect(triggers.every((trigger) => trigger.closest('.cloud-rain-lane'))).toBe(true);
    expect(triggers.every((trigger) => !trigger.closest('.time-axis'))).toBe(true);
    expect(document.querySelector('.minutely-rain-trigger')).toBeNull();
    expect(document.querySelector('.minutely-rain-hint')).toHaveStyle({ width: '66px' });

    fireEvent.click(triggers[1] as HTMLElement);
    expect(onMinutelySelect).toHaveBeenCalledWith(1);
  });

  it('only widens two hours when minutely precipitation is opened on the hour', () => {
    const data = makeTimeline(4);
    const selectedItem = data[1];
    const onMinutelySelect = vi.fn();
    if (!selectedItem) throw new Error('Missing selected test hour');

    const { container } = render(
      <DashboardLaneStack
        data={data}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'loading',
          data: null,
          error: null,
          referenceTimeMs: Date.parse(selectedItem.time),
        }}
        onMinutelySelect={onMinutelySelect}
      />,
    );

    expect(container.querySelector('.lanes-container')).toHaveStyle({ width: '308px' });
    const timeCells = [...container.querySelectorAll<HTMLElement>('.time-axis .lane-cell')];
    expect(timeCells.map((cell) => cell.style.width)).toEqual(['22px', '132px', '132px', '22px']);
    expect(container.querySelector('.minutely-rain-inline')).toHaveStyle({
      left: '22px',
      width: '264px',
    });

    fireEvent.click(screen.getByRole('button', { name: '收起 5 分钟降水' }));
    expect(onMinutelySelect).toHaveBeenCalledWith(1);
  });

  it('shows every sampled label inside the expanded detail region', () => {
    const data = makeTimeline(5);
    data.forEach((item, index) => {
      item.uvIndex = 3;
      item.weatherCode = 1;
      item.precipitationProb = 10 + index;
    });
    const selectedItem = data[1];
    if (!selectedItem) throw new Error('Missing selected test hour');

    const { container } = render(
      <DashboardLaneStack
        data={data}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'loading',
          data: null,
          error: null,
        }}
      />,
    );

    const timeCells = [...container.querySelectorAll<HTMLElement>('.time-axis .lane-cell')];
    expect(timeCells.map((cell) => cell.textContent?.trim())).toEqual(['0', '1', '2', '3', '']);

    const windCells = [...container.querySelectorAll<HTMLElement>('.wind-lane .lane-cell')];
    expect(windCells.map((cell) => Boolean(cell.textContent?.trim()))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);

    const probabilityCells = [
      ...container.querySelectorAll<HTMLElement>('.precip-prob-lane .lane-cell'),
    ];
    expect(probabilityCells.map((cell) => cell.textContent?.trim())).toEqual([
      '10%',
      '11%',
      '12%',
      '13%',
      '',
    ]);
    expect(container.querySelectorAll('.uv-run-value')).toHaveLength(5);
    expect(container.querySelectorAll('.weather-run-overlay')).toHaveLength(5);
  });

  it('shows each compact temperature label inside the expanded detail region', () => {
    const data = makeTimeline(5);
    const selectedItem = data[1];
    if (!selectedItem) throw new Error('Missing selected test hour');

    const { container } = render(
      <DashboardLaneStack
        data={data}
        compactMode
        scales={SCALES}
        switchInfo={{}}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'loading',
          data: null,
          error: null,
        }}
      />,
    );

    const temperatureCells = [
      ...container.querySelectorAll<HTMLElement>('.temp-text-lane .lane-cell'),
    ];
    expect(temperatureCells.map((cell) => Boolean(cell.textContent?.trim()))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('keeps hourly precipitation amounts visible while minutely precipitation is expanded', () => {
    const data = makeTimeline(4);
    const selectedItem = data[1];
    const nextItem = data[2];
    if (!selectedItem || !nextItem) throw new Error('Missing selected test hours');
    selectedItem.precipitation = 3.4;
    nextItem.precipitation = 1.2;

    render(
      <DashboardLaneStack
        data={data}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'success',
          data: {
            updateTime: '2026-05-23T01:00:00Z',
            fxLink: 'https://www.qweather.com',
            summary: '未来两小时有雨',
            points: [
              { fxTime: '2026-05-23T01:05:00Z', precip: 0.1, type: 'rain' },
              { fxTime: '2026-05-23T01:10:00Z', precip: 0.25, type: 'rain' },
              { fxTime: '2026-05-23T01:15:00Z', precip: 0.3, type: 'rain' },
              { fxTime: '2026-05-23T01:20:00Z', precip: 0, type: 'rain' },
            ],
          },
          error: null,
        }}
      />,
    );

    expect(screen.getByLabelText('小时降水 3.4 毫米')).toBeInTheDocument();
    expect(screen.getByLabelText('小时降水 1.2 毫米')).toBeInTheDocument();
    expect(screen.queryByLabelText('5分钟降水 0.10 毫米')).toBeNull();
    expect(screen.getByLabelText('5分钟降水 0.25 毫米')).toHaveTextContent('0.25');
    expect(screen.queryByLabelText('5分钟降水 0.30 毫米')).toBeNull();
    expect(screen.queryByLabelText('5分钟降水 0.00 毫米')).toBeNull();
    expect(screen.queryByText('5分钟降水强度 · 0–10 mm/h')).toBeNull();
  });

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
