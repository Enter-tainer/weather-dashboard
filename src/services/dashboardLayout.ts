export type DashboardLayoutMode = 'standard' | 'reader';
export type DashboardOrientation = 'portrait' | 'landscape';

export interface DashboardLayoutMetrics {
  mode: DashboardLayoutMode;
  orientation: DashboardOrientation;
  hourWidth: number;
  legendWidth: number;
  locationHeight: number;
  timeAxisHeight: number;
  twilightHeight: number;
  weatherIconHeight: number;
  uvHeight: number;
  thermalHeight: number;
  cloudEnsembleHeight: number;
  cloudRainHeight: number;
  cloudPlotHeight: number;
  precipitationPlotHeight: number;
  precipitationProbabilityHeight: number;
  capeHeight: number;
  windHeight: number;
  windBottomAreaHeight: number;
  pressureHeight: number;
  aqiHeight: number;
  visibilityHeight: number;
  aerosolHeight: number;
  canvasLabelFontSize: number;
}

const STANDARD_LAYOUT: DashboardLayoutMetrics = {
  mode: 'standard',
  orientation: 'landscape',
  hourWidth: 22,
  legendWidth: 48,
  locationHeight: 24,
  timeAxisHeight: 50,
  twilightHeight: 12,
  weatherIconHeight: 28,
  uvHeight: 25,
  thermalHeight: 80,
  cloudEnsembleHeight: 50,
  cloudRainHeight: 150,
  cloudPlotHeight: 108,
  precipitationPlotHeight: 40,
  precipitationProbabilityHeight: 25,
  capeHeight: 30,
  windHeight: 80,
  windBottomAreaHeight: 30,
  pressureHeight: 45,
  aqiHeight: 30,
  visibilityHeight: 20,
  aerosolHeight: 30,
  canvasLabelFontSize: 8,
};

const READER_LANDSCAPE_LAYOUT: DashboardLayoutMetrics = {
  mode: 'reader',
  orientation: 'landscape',
  hourWidth: 36,
  legendWidth: 80,
  locationHeight: 30,
  timeAxisHeight: 60,
  twilightHeight: 14,
  weatherIconHeight: 36,
  uvHeight: 32,
  thermalHeight: 92,
  cloudEnsembleHeight: 58,
  cloudRainHeight: 175,
  cloudPlotHeight: 133,
  precipitationPlotHeight: 40,
  precipitationProbabilityHeight: 32,
  capeHeight: 36,
  windHeight: 92,
  windBottomAreaHeight: 34,
  pressureHeight: 52,
  aqiHeight: 36,
  visibilityHeight: 26,
  aerosolHeight: 36,
  canvasLabelFontSize: 13,
};

const READER_PORTRAIT_LAYOUT: DashboardLayoutMetrics = {
  mode: 'reader',
  orientation: 'portrait',
  hourWidth: 36,
  legendWidth: 80,
  locationHeight: 34,
  timeAxisHeight: 72,
  twilightHeight: 18,
  weatherIconHeight: 44,
  uvHeight: 40,
  thermalHeight: 125,
  cloudEnsembleHeight: 76,
  cloudRainHeight: 245,
  cloudPlotHeight: 203,
  precipitationPlotHeight: 40,
  precipitationProbabilityHeight: 42,
  capeHeight: 44,
  windHeight: 120,
  windBottomAreaHeight: 40,
  pressureHeight: 64,
  aqiHeight: 44,
  visibilityHeight: 32,
  aerosolHeight: 44,
  canvasLabelFontSize: 14,
};

export function getDashboardLayoutMetrics(
  mode: DashboardLayoutMode,
  orientation: DashboardOrientation,
): DashboardLayoutMetrics {
  if (mode === 'reader') {
    return orientation === 'portrait' ? READER_PORTRAIT_LAYOUT : READER_LANDSCAPE_LAYOUT;
  }
  return { ...STANDARD_LAYOUT, orientation };
}

export function getDashboardStackHeight(metrics: DashboardLayoutMetrics): number {
  return (
    metrics.locationHeight +
    metrics.timeAxisHeight +
    metrics.twilightHeight +
    metrics.weatherIconHeight +
    metrics.uvHeight +
    metrics.thermalHeight +
    metrics.cloudEnsembleHeight +
    metrics.cloudRainHeight +
    metrics.precipitationProbabilityHeight +
    metrics.capeHeight +
    metrics.windHeight +
    metrics.pressureHeight +
    metrics.aqiHeight +
    metrics.visibilityHeight +
    metrics.aerosolHeight
  );
}

export function getVisibleTimelineHours(
  viewportWidth: number,
  metrics: DashboardLayoutMetrics,
): number {
  return Math.max(0, (viewportWidth - metrics.legendWidth) / metrics.hourWidth);
}

export function dashboardLayoutCssVariables(
  metrics: DashboardLayoutMetrics,
): Record<`--${string}`, string> {
  return {
    '--col-width-hour': `${metrics.hourWidth}px`,
    '--legend-width': `${metrics.legendWidth}px`,
    '--lane-height-location': `${metrics.locationHeight}px`,
    '--lane-height-basic': `${metrics.timeAxisHeight}px`,
    '--lane-height-twilight': `${metrics.twilightHeight}px`,
    '--lane-height-weather-icon': `${metrics.weatherIconHeight}px`,
    '--lane-height-uv': `${metrics.uvHeight}px`,
    '--lane-height-thermal': `${metrics.thermalHeight}px`,
    '--lane-height-cloud-ensemble': `${metrics.cloudEnsembleHeight}px`,
    '--lane-height-clouds': `${metrics.cloudRainHeight}px`,
    '--lane-height-precip-prob': `${metrics.precipitationProbabilityHeight}px`,
    '--lane-height-cape': `${metrics.capeHeight}px`,
    '--lane-height-wind': `${metrics.windHeight}px`,
    '--lane-height-pressure': `${metrics.pressureHeight}px`,
    '--lane-height-aqi': `${metrics.aqiHeight}px`,
    '--lane-height-visibility': `${metrics.visibilityHeight}px`,
    '--lane-height-aerosol': `${metrics.aerosolHeight}px`,
  };
}
