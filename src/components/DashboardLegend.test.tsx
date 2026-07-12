import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardScales } from '../types/weather';
import DashboardLegend from './DashboardLegend';

const SCALES: DashboardScales = {
  minTemp: 0,
  maxTemp: 30,
  minP: 1000,
  maxP: 1020,
  maxBft: 6,
  tempSteps: [0, 10, 20, 30],
};

describe('DashboardLegend', () => {
  it('uses one typography system for titles, units, secondary text, and axis ticks', () => {
    const { container } = render(
      <DashboardLegend compactMode={false} scales={SCALES} showGitHubLink={false} />,
    );

    for (const label of ['星期', '天气', 'AQI', 'AOD']) {
      expect(screen.getByText(label)).toHaveClass('legend-title');
    }

    const units = container.querySelectorAll('.legend-unit');
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      expect(unit.parentElement).toHaveClass('legend-title');
    }

    expect(screen.getByText('小时')).toHaveClass('legend-secondary');
    expect(screen.getByText('20°')).toHaveClass('legend-axis-tick');
    expect(screen.getByText('10k')).toHaveClass('legend-axis-tick');
  });

  it('puts all three shared rain guides in the left legend', () => {
    const { container } = render(
      <DashboardLegend compactMode={false} scales={SCALES} showGitHubLink={false} />,
    );

    expect(screen.getByText('雨强')).toBeInTheDocument();
    const lightRain = screen.getByLabelText('小雨 1 mm/h');
    expect(lightRain).toHaveStyle({
      color: 'var(--text-faint)',
      borderTopStyle: 'none',
    });
    expect(lightRain).toHaveTextContent('小雨 1');
    expect(lightRain.querySelector('.rain-intensity-legend-label')).toHaveClass('legend-axis-tick');
    expect(screen.getByLabelText('中雨 5 mm/h')).toBeInTheDocument();
    expect(screen.getByLabelText('大雨 10 mm/h')).toBeInTheDocument();
    expect(container.querySelectorAll('.rain-intensity-legend-row')).toHaveLength(3);
  });
});
