import { MapPin } from 'lucide-react';
import './Dashboard.css';

export default function LocationLane({ data, switchInfo, onCityClick }) {
  const COL_WIDTH = 22;

  const cityGroups = [];
  let currentGroup = null;
  for (let i = 0; i < data.length; i++) {
    if (i === 0 || data[i].cityName !== data[i - 1].cityName) {
      currentGroup = { cityName: data[i].cityName, startIndex: i, items: [] };
      cityGroups.push(currentGroup);
    }
    currentGroup.items.push(data[i]);
  }

  return (
    <div className="lane location-lane" style={{ height: '24px', borderBottom: 'none', backgroundColor: '#e5e5e5' }}>
      <div className="lane-data" style={{ position: 'relative', width: `${data.length * COL_WIDTH}px` }}>
        {cityGroups.map((group) => {
          const slot = switchInfo && switchInfo[group.cityName];
          const isSwitchable = !!slot;
          
          return (
            <div key={`loc-${group.startIndex}`} style={{ position: 'absolute', left: `${group.startIndex * COL_WIDTH}px`, width: `${group.items.length * COL_WIDTH}px`, height: '100%', display: 'block' }}>
              <div style={{ position: 'sticky', left: 0, width: 'max-content', zIndex: 100 }}>
                <div
                  onClick={isSwitchable ? () => onCityClick(group.cityName) : undefined}
                  style={{
                    padding: '2px 8px',
                    backgroundColor: 'rgba(232, 232, 232, 0.95)',
                    fontWeight: 'bold', fontSize: '13px',
                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                    cursor: isSwitchable ? 'pointer' : 'default',
                    userSelect: 'none', color: '#333'
                  }}
                >
                  <MapPin size={12} color="#d32f2f" />
                  {group.cityName}
                  {isSwitchable && (
                    <span style={{ fontSize: '9px', color: '#999', marginLeft: '4px' }}>
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
