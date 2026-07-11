import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeWeatherPoint, makeWeatherTimeline } from '../test-utils/weather';
import type { DashboardScales, WeatherTimeline } from '../types/weather';
import DashboardCaptureRender from './DashboardCaptureRender';

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

function makeTimeline(): WeatherTimeline {
  return makeWeatherTimeline(
    Array.from({ length: 4 }, (_, index) =>
      makeWeatherPoint({
        time: `2026-07-11T${String(15 + index).padStart(2, '0')}:00:00+08:00`,
        hour: 15 + index,
      }),
    ),
  );
}

describe('DashboardCaptureRender minutely precipitation', () => {
  it('keeps the complete expanded two-hour chart in an exported capture', () => {
    const data = makeTimeline();
    const selectedItem = data[1];
    if (!selectedItem) throw new Error('Missing selected test hour');

    const { container } = render(
      <DashboardCaptureRender
        data={data}
        selection={{ startIndex: 0, endIndex: 4 }}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'success',
          error: null,
          data: {
            updateTime: '2026-07-11T16:00+08:00',
            fxLink: 'https://www.qweather.com',
            summary: '间歇性降雨还将持续，未来两小时请注意出行安全',
            points: [{ fxTime: '2026-07-11T16:00+08:00', precip: 0.21, type: 'rain' }],
          },
        }}
      />,
    );

    expect(screen.getByLabelText('天气截图')).toHaveStyle({ width: '356px' });
    expect(container.querySelector('.minutely-rain-inline')).toBeInTheDocument();
    expect(screen.getByText('间歇性降雨还将持续，未来两小时请注意出行安全')).toBeInTheDocument();
    expect(screen.getByText('16:00').closest('.precip-prob-lane')).not.toBeNull();
    expect(screen.queryByText('和风天气')).toBeNull();
    expect(container.querySelector('.minutely-rain-inline-actions')).toBeNull();
    expect(screen.queryByRole('button', { name: '收起 5 分钟降水' })).toBeNull();
  });

  it('does not include a partial minutely range when only one source hour is captured', () => {
    const data = makeTimeline();
    const selectedItem = data[1];
    if (!selectedItem) throw new Error('Missing selected test hour');

    const { container } = render(
      <DashboardCaptureRender
        data={data}
        selection={{ startIndex: 1, endIndex: 2 }}
        compactMode={false}
        scales={SCALES}
        switchInfo={{}}
        minutelySelection={{
          index: 1,
          item: selectedItem,
          status: 'loading',
          error: null,
          data: null,
        }}
      />,
    );

    expect(screen.getByLabelText('天气截图')).toHaveStyle({ width: '70px' });
    expect(container.querySelector('.minutely-rain-inline')).toBeNull();
  });
});
