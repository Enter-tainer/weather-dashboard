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
                      <>
                        <div style={{ position: 'absolute', top: '2px', left: '4px', zIndex: 5, fontSize: '11px', color: '#333', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                          {dateStr}
                        </div>
                        {item.moonPhase != null && (
                          <div style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '9px', color: '#777', whiteSpace: 'nowrap', zIndex: 5 }}>
                            {getMoonPhaseName(item.moonPhase)} {Math.round(item.moonFraction * 100)}%
                          </div>
                        )}
                      </>
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
                top: '34px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 21
             }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: color, whiteSpace: 'nowrap', fontWeight: 'bold', textShadow: '0 0 2px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)' }}>
                   <IconComp size={10} color={color} /> {hh}:{mm}
                </div>
                <div style={{ height: '6px', width: '1px', backgroundColor: color, marginTop: '2px', opacity: 0.8 }} />
             </div>
           );
        })}

        {/* Moon Events Overlay */}
        {data.moonEvents && data.moonEvents.map((ev, i) => {
           const exactX = ev.absoluteIndex * COL_WIDTH + COL_WIDTH / 2;
           if (exactX < 0 || exactX > data.length * COL_WIDTH) return null;

           const mm = ev.time.getMinutes().toString().padStart(2, '0');
           const hh = ev.time.getHours().toString().padStart(2, '0');
           const isRise = ev.type === 'moonrise';
           const color = isRise ? '#5c6bc0' : '#37474f';
           const arrow = isRise ? '↑' : '↓';

           return (
             <div key={`moon-${i}`} style={{
                position: 'absolute',
                left: `${exactX}px`,
                top: '16px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20
             }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: color, whiteSpace: 'nowrap', fontWeight: 'bold', textShadow: '0 0 2px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)' }}>
                   <Moon size={10} color={color} />{arrow}{hh}:{mm}
                </div>
                <div style={{ height: '18px', width: '1px', backgroundColor: color, marginTop: '2px', opacity: 0.8 }} />
             </div>
           );
        })}
      </div>
    </div>
  );
}
