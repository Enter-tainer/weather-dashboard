import { Sunrise, Sunset, Moon, MapPin } from 'lucide-react';
import './Dashboard.css';

function getMoonPhaseName(phase) {
  if (phase < 0.0625) return '新月';
  if (phase < 0.1875) return '蛾眉月';
  if (phase < 0.3125) return '上弦月';
  if (phase < 0.4375) return '盈凸月';
  if (phase < 0.5625) return '满月';
  if (phase < 0.6875) return '亏凸月';
  if (phase < 0.8125) return '下弦月';
  if (phase < 0.9375) return '残月';
  return '新月';
}

export default function TimeAxis({ data, switchInfo, onCityClick }) {
  const COL_WIDTH = 22;

  // Group data items by city block
  const cityGroups = [];
  let currentGroup = null;
  for (let i = 0; i < data.length; i++) {
    if (i === 0 || data[i].cityName !== data[i - 1].cityName) {
      currentGroup = { cityName: data[i].cityName, startIndex: i, items: [] };
      cityGroups.push(currentGroup);
    }
    currentGroup.items.push({ item: data[i], index: i });
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

        {/* City blocks - each wraps its cells so the label can be CSS sticky */}
        {cityGroups.map((group) => {
          const slot = switchInfo && switchInfo[group.cityName];
          const isSwitchable = !!slot;
          return (
            <div key={`block-${group.startIndex}`} style={{ display: 'flex', position: 'relative' }}>
              {/* Sticky label anchor - zero width so it doesn't affect cell layout */}
              <div style={{ position: 'sticky', left: 0, width: 0, zIndex: 100, flexShrink: 0 }}>
                <div
                  onClick={isSwitchable ? () => onCityClick(group.cityName) : undefined}
                  style={{
                    position: 'absolute', top: 0, left: 0, padding: '2px 8px',
                    backgroundColor: 'rgba(232, 232, 232, 0.75)', fontWeight: 'bold', fontSize: '12px',
                    whiteSpace: 'nowrap', borderRight: '1px solid #ccc',
                    borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: '3px',
                    cursor: isSwitchable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  <MapPin size={12} color="#d32f2f" />
                  {group.cityName}
                  {isSwitchable && (
                    <span style={{ fontSize: '9px', color: '#999', marginLeft: '4px' }}>
                      {slot.activeIndex + 1}/{slot.cities.length}
                    </span>
                  )}
                </div>
              </div>
              {/* Lane cells for this city */}
              {group.items.map(({ item, index }) => {
                const isFirstOfCity = index === group.startIndex;
                const isDateLabel = item.hour === 0 || isFirstOfCity;
                const dateObj = new Date(item.time);
                const dayStr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dateObj.getDay()];
                const dateStr = `${dayStr} ${dateObj.getDate()}`;
                return (
                  <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '4px', zIndex: 5 }}>
                    {isDateLabel && (
                      <div style={{ position: 'absolute', top: '22px', left: '4px', fontSize: '12px', color: '#555', whiteSpace: 'nowrap', zIndex: 5 }}>
                        {dateStr}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#888', marginTop: 'auto' }}>
                      {item.hour % 3 === 0 && item.hour !== 0 ? item.hour : ''}
                    </div>
                    <div style={{ position: 'absolute', right: 0, top: '40px', bottom: 0, width: '1px', backgroundColor: item.hour % 3 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent' }} />
                  </div>
                );
              })}
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

        {/* Moon Events Overlay — same style as sun events */}
        {data.moonEvents && data.moonEvents.map((ev, i) => {
           const exactX = ev.absoluteIndex * COL_WIDTH + COL_WIDTH / 2;
           if (exactX < 0 || exactX > data.length * COL_WIDTH) return null;

           const mm = ev.time.getMinutes().toString().padStart(2, '0');
           const hh = ev.time.getHours().toString().padStart(2, '0');
           const isRise = ev.type === 'moonrise';
           const color = isRise ? '#5c6bc0' : '#37474f';
           const arrow = isRise ? '↑' : '↓';
           const phaseName = getMoonPhaseName(ev.phase);

           return (
             <div key={`moon-${i}`} style={{
                position: 'absolute',
                left: `${exactX}px`,
                top: '11px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20
             }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: color, whiteSpace: 'nowrap', fontWeight: 'bold', background: 'rgba(255,255,255,0.85)', padding: '1px 3px', borderRadius: '3px', lineHeight: 1 }}>
                   <Moon size={10} color={color} />{arrow}{hh}:{mm}
                </div>
                <div style={{ fontSize: '8px', color: color, opacity: 0.7, marginTop: '1px' }}>{phaseName}</div>
                <div style={{ height: '10px', width: '1px', backgroundColor: color, marginTop: '1px', opacity: 0.6 }} />
             </div>
           );
        })}
      </div>
    </div>
  );
}
