import { MapPin } from 'lucide-react';
import type { SwitchInfo } from '../hooks/useDashboardData';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

interface CityGroup {
  cityName: string;
  startIndex: number;
  items: WeatherPoint[];
}

interface LocationLaneProps {
  data: WeatherPoint[];
  switchInfo: SwitchInfo;
  onCityClick: (cityName: string) => void;
  interactive?: boolean;
}

export default function LocationLane({ data, switchInfo, onCityClick, interactive = true }: LocationLaneProps) {
  const COL_WIDTH = 22;

  const cityGroups: CityGroup[] = [];
  let currentGroup: CityGroup | null = null;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;

    if (i === 0 || item.cityName !== data[i - 1]?.cityName) {
      currentGroup = { cityName: item.cityName, startIndex: i, items: [] };
      cityGroups.push(currentGroup);
    }
    currentGroup?.items.push(item);
  }

  return (
    <div className="lane location-lane" style={{ height: '24px', borderBottom: 'none', backgroundColor: 'var(--legend-bg)' }}>
      <div className="lane-data" style={{ position: 'relative', width: `${data.length * COL_WIDTH}px` }}>
        {cityGroups.map((group) => {
          const slot = switchInfo && switchInfo[group.cityName];
          const isSwitchable = interactive && !!slot;
          
          return (
            <div key={`loc-${group.startIndex}`} style={{ position: 'absolute', left: `${group.startIndex * COL_WIDTH}px`, width: `${group.items.length * COL_WIDTH}px`, height: '100%', display: 'block' }}>
              <div style={{ position: 'sticky', left: 0, width: 'max-content', zIndex: 100 }}>
                <div
                  onClick={isSwitchable ? () => onCityClick(group.cityName) : undefined}
                  style={{
                    padding: '2px 8px',
                    backgroundColor: 'var(--legend-bg)',
                    fontWeight: 'bold', fontSize: '13px',
                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                    cursor: isSwitchable ? 'pointer' : 'default',
                    userSelect: 'none', color: 'var(--text-main)'
                  }}
                >
                  <MapPin size={12} color="var(--color-temp-line)" />
                  {group.cityName}
                  {isSwitchable && (
                    <span style={{ fontSize: '9px', color: 'var(--text-subtle)', marginLeft: '4px' }}>
                      {slot.activeIndex + 1}/{slot.entries.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
