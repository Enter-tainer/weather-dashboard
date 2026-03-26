import { Sunrise, Sunset, MapPin } from 'lucide-react';
import './Dashboard.css';

export default function TimeAxis({ data, switchInfo, onCityClick }) {
  const COL_WIDTH = 22;

  // Pre-compute city label positions (first hour index of each city block)
  const cityLabels = [];
  for (let i = 0; i < data.length; i++) {
    const isFirstOfCity = i === 0 || data[i-1].cityName !== data[i].cityName;
    if (isFirstOfCity) {
      const slot = switchInfo && switchInfo[data[i].cityName];
      cityLabels.push({ index: i, cityName: data[i].cityName, slot });
    }
  }

  return (
    <div className="lane time-axis" style={{ height: 'var(--lane-height-basic)' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        {/* Darker localized overlay for the header night periods */}
        {data.nightBands && data.nightBands.map((band, idx) => {
           const leftPx = band.left * COL_WIDTH + COL_WIDTH / 2;
           const rightPx = band.right * COL_WIDTH + COL_WIDTH / 2;
           return (
              <div key={`header-night-${idx}`} style={{ position: 'absolute', top: 0, left: `${leftPx}px`, width: `${rightPx - leftPx}px`, height: '100%', backgroundColor: 'rgba(0,0,0,0.06)', pointerEvents: 'none', zIndex: 0 }} />
           );
        })}

        {data.map((item, index) => {
        const isFirstOfCity = index === 0 || data[index-1].cityName !== item.cityName;
        const isDateLabel = item.hour === 0 || isFirstOfCity;

        const dateObj = new Date(item.time);
        const dayStr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dateObj.getDay()];
        const dateStr = `${dayStr} ${dateObj.getDate()}`;

        return (
          <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '4px', zIndex: 5 }}>
            {/* Date label */}
            {isDateLabel && (
              <div style={{ position: 'absolute', top: '22px', left: '4px', fontSize: '12px', color: '#555', whiteSpace: 'nowrap', zIndex: 5 }}>
                {dateStr}
              </div>
            )}

            {/* Hour marker */}
            <div style={{ fontSize: '12px', color: '#888', marginTop: 'auto' }}>
              {item.hour % 3 === 0 && item.hour !== 0 ? item.hour : ''}
            </div>
            {/* Grid line separator */}
            <div style={{ position: 'absolute', right: 0, top: '40px', bottom: 0, width: '1px', backgroundColor: item.hour % 3 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent' }} />
          </div>
        );
      })}

        {/* City labels - rendered outside lane-cells to avoid stacking context issues */}
        {cityLabels.map(({ index, cityName, slot }) => {
          const isSwitchable = !!slot;
          const leftPx = index * COL_WIDTH;
          return (
            <div
              key={`city-${index}`}
              onClick={isSwitchable ? () => onCityClick(cityName) : undefined}
              style={{
                position: 'absolute', top: 0, left: `${leftPx}px`, padding: '2px 8px',
                backgroundColor: '#e8e8e8', fontWeight: 'bold', fontSize: '12px',
                zIndex: 15, whiteSpace: 'nowrap', borderRight: '1px solid #ccc',
                borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: '3px',
                cursor: isSwitchable ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              <MapPin size={12} color="#d32f2f" />
              {cityName}
              {isSwitchable && (
                <span style={{ fontSize: '9px', color: '#999', marginLeft: '4px' }}>
                  {slot.activeIndex + 1}/{slot.cities.length}
                </span>
              )}
            </div>
          );
        })}

        {/* Sun Events Overlay */}
        {data.sunEvents && data.sunEvents.map((ev, i) => {
           const exactX = ev.absoluteIndex * COL_WIDTH + COL_WIDTH / 2;
           if (exactX < 0 || exactX > data.length * COL_WIDTH) return null;

           const mm = ev.time.getMinutes().toString().padStart(2, '0');
           const hh = ev.time.getHours().toString().padStart(2, '0');
           const isSunrise = ev.type === 'sunrise';
           const IconComp = isSunrise ? Sunrise : Sunset;
           const color = isSunrise ? '#f57c00' : '#d84315';

           return (
             <div key={`sun-${i}`} style={{
                position: 'absolute',
                left: `${exactX}px`,
                top: '11px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20
             }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: color, whiteSpace: 'nowrap', fontWeight: 'bold', background: 'rgba(255,255,255,0.85)', padding: '1px 3px', borderRadius: '3px', lineHeight: 1 }}>
                   <IconComp size={10} color={color} /> {hh}:{mm}
                </div>
                <div style={{ height: '17px', width: '1px', backgroundColor: color, marginTop: '2px', opacity: 0.6 }} />
             </div>
           );
        })}
      </div>
    </div>
  );
}
