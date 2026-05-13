import { useMemo } from 'react';
import RouteEditor from './RouteEditor';
import CompactToggle from './CompactToggle';
import DashboardLegend from './DashboardLegend';
import DashboardLanes from './DashboardLanes';
import { useCompactMode } from '../hooks/useCompactMode';
import { useDashboardData } from '../hooks/useDashboardData';
import { calculateDashboardScales } from '../services/weatherMetrics';

import './Dashboard.css';

export default function Dashboard({ testData }) {
  const { compactMode, toggleCompactMode } = useCompactMode();
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
