import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import PrecipitationProbLane from './PrecipitationProbLane';

describe('PrecipitationProbLane', () => {
  it('shows every third non-compact probability label above threshold', () => {
    render(
      <PrecipitationProbLane
        data={[
          makeWeatherPoint({ precipitationProb: 4 }),
          makeWeatherPoint({ precipitationProb: 80 }),
          makeWeatherPoint({ precipitationProb: 90 }),
          makeWeatherPoint({ precipitationProb: 60 }),
        ]}
      />,
    );

    expect(screen.queryByText('4%')).not.toBeInTheDocument();
    expect(screen.queryByText('80%')).not.toBeInTheDocument();
    expect(screen.queryByText('90%')).not.toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders compact precipitation amount and probability summaries', () => {
    render(
      <PrecipitationProbLane
        compact
        data={[
          makeWeatherPoint({ precipitation: 0.05, precipitationProb: 10 }),
          makeWeatherPoint({ precipitation: 1.6, precipitationProb: 70, weatherCode: 71 }),
          makeWeatherPoint({ precipitation: 12, precipitationProb: 90 }),
        ]}
      />,
    );

    expect(screen.queryByText('0.1')).not.toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('1.6')).toBeInTheDocument();
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
