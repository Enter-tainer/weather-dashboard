import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import AirQualityLane from './AirQualityLane';

describe('AirQualityLane', () => {
  it('renders AQI and visibility labels for available values', () => {
    const { container } = render(
      <AirQualityLane
        data={[
          makeWeatherPoint({ aqiUS: 42, visibility: 10_000 }),
          makeWeatherPoint({ aqiUS: 101, visibility: 3500 }),
        ]}
      />,
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3.5')).toBeInTheDocument();
    expect(container.querySelectorAll('.aqi-cell')[0]).toHaveClass('eink-pattern-empty');
    expect(container.querySelectorAll('.aqi-cell')[1]).toHaveClass('eink-pattern-dots-2');
    expect(container.querySelectorAll('.visibility-cell')[0]).toHaveClass('eink-pattern-empty');
    expect(container.querySelectorAll('.visibility-cell')[1]).toHaveClass(
      'eink-pattern-horizontal',
    );
  });

  it('leaves missing AQI and visibility cells blank', () => {
    const { container } = render(
      <AirQualityLane data={[makeWeatherPoint({ aqiUS: null, visibility: null })]} />,
    );

    expect(container.querySelector('.lane-data')?.textContent).toBe('');
    expect(container.querySelectorAll('.lane-cell')).toHaveLength(2);
  });
});
