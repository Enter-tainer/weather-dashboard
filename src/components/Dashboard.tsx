import { useMemo } from 'react';
import RouteEditor from './RouteEditor';
import CompactToggle from './CompactToggle';
import ThemeToggle from './ThemeToggle';
import DashboardLegend from './DashboardLegend';
import DashboardLanes from './DashboardLanes';
import { useCompactMode } from '../hooks/useCompactMode';
import { useDashboardData } from '../hooks/useDashboardData';
import { useThemeMode } from '../hooks/useThemeMode';
import { calculateDashboardScales } from '../services/weatherMetrics';
import type { WeatherTimeline } from '../types/weather';

import './Dashboard.css';

interface DashboardProps {
  testData?: WeatherTimeline | undefined;
}

export default function Dashboard({ testData }: DashboardProps) {
  const { compactMode, toggleCompactMode } = useCompactMode();
  const { mode, effectiveTheme, cycleThemeMode } = useThemeMode();
  const {
    data,
    loadingDone,
    switching,
    switchInfo,
    handleCityClick,
  } = useDashboardData(testData);
  const scales = useMemo(() => calculateDashboardScales(data), [data]);

  return (
    <div className="dashboard-wrapper">
      <ThemeToggle mode={mode} effectiveTheme={effectiveTheme} onToggle={cycleThemeMode} />
      <CompactToggle compactMode={compactMode} onToggle={toggleCompactMode} />
      <RouteEditor />
      <DashboardLegend compactMode={compactMode} scales={scales} />
      <DashboardLanes
        data={data}
        loadingDone={loadingDone}
        switching={switching}
        switchInfo={switchInfo}
        onCityClick={handleCityClick}
        compactMode={compactMode}
        scales={scales}
      />
    </div>
  );
}
