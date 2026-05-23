import { Sunrise, Sunset, Moon } from 'lucide-react';
import type { WeatherPoint, WeatherTimeline } from '../types/weather';
import './Dashboard.css';

interface IndexedWeatherPoint {
  item: WeatherPoint;
  index: number;
}

interface CityGroup {
  cityName: string;
  startIndex: number;
  items: IndexedWeatherPoint[];
}

interface DayGroup {
  dateKey: string;
  dateStr: string;
  items: IndexedWeatherPoint[];
  startIndex: number;
  moonPhase?: number | undefined;
  moonFraction?: number | undefined;
}

interface TimeAxisProps {
  data: WeatherTimeline;
}

function getMoonPhaseName(phase: number): string {
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

export default function TimeAxis({ data }: TimeAxisProps) {
  const COL_WIDTH = 22;

  // Group data items by city block
  const cityGroups: CityGroup[] = [];
  let currentGroup: CityGroup | null = null;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;

    if (i === 0 || item.cityName !== data[i - 1]?.cityName) {
      currentGroup = { cityName: item.cityName, startIndex: i, items: [] };
      cityGroups.push(currentGroup);
    }
    currentGroup?.items.push({ item, index: i });
  }

  return (
    <div className="lane time-axis" style={{ height: 'var(--lane-height-basic)' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        {/* Darker localized overlay for the header night periods */}
        {data.nightBands && data.nightBands.map((band, idx) => {
           const leftPx = band.left * COL_WIDTH + COL_WIDTH / 2;
           const rightPx = band.right * COL_WIDTH + COL_WIDTH / 2;
           return (
              <div key={`header-night-${idx}`} style={{ position: 'absolute', top: 0, left: `${leftPx}px`, width: `${rightPx - leftPx}px`, height: '100%', backgroundColor: 'var(--cell-night)', pointerEvents: 'none', zIndex: 0 }} />
           );
        })}

        {/* City blocks - each wraps its cells so the label can be CSS sticky */}
        {cityGroups.map((group) => {
          // Sub-group by date within each city
          const dayGroups: DayGroup[] = [];
          let currentDay: DayGroup | null = null;
          for (const { item, index } of group.items) {
            const dateKey = new Date(item.time).toDateString();
            if (!currentDay || currentDay.dateKey !== dateKey) {
              const dateObj = new Date(item.time);
              const dayStr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dateObj.getDay()] ?? '';
              currentDay = { dateKey, dateStr: `${dayStr} ${dateObj.getDate()}`, items: [], startIndex: index, moonPhase: item.moonPhase, moonFraction: item.moonFraction };
              if (currentDay) dayGroups.push(currentDay);
            }
            currentDay?.items.push({ item, index });
          }

          return (
            <div key={`block-${group.startIndex}`} style={{ display: 'flex', position: 'relative' }}>
              {/* Sticky day label overlays */}
              {dayGroups.map((day) => (
                <div key={`daylabel-${day.startIndex}`} style={{
                  position: 'absolute',
                  left: `${(day.startIndex - group.startIndex) * COL_WIDTH}px`,
                  width: `${day.items.length * COL_WIDTH}px`,
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 10
                }}>
                  <div style={{ position: 'sticky', left: 0, width: 'max-content' }}>
                    <div style={{ padding: '2px 4px', fontSize: '11px', color: 'var(--text-main)', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                      {day.dateStr}
                    </div>
                  </div>
                  {day.moonPhase != null && day.moonFraction != null && (
                    <div style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {getMoonPhaseName(day.moonPhase)} {Math.round(day.moonFraction * 100)}%
                    </div>
                  )}
                </div>
              ))}

              {/* Lane cells for this city */}
              {group.items.map(({ item, index }) => (
                <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '4px', zIndex: 5 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: 'auto' }}>
                    {item.hour % 3 === 0 && item.hour !== 0 ? item.hour : ''}
                  </div>
                  <div style={{ position: 'absolute', right: 0, top: '40px', bottom: 0, width: '1px', backgroundColor: item.hour % 3 === 0 ? 'var(--lane-border)' : 'transparent' }} />
                </div>
              ))}
            </div>
          );
        })}

        {/* Sun Events Overlay */}
        {data.sunEvents && data.sunEvents.map((ev, i) => {
           if (ev.absoluteIndex == null) return null;
           const exactX = ev.absoluteIndex * COL_WIDTH + COL_WIDTH / 2;
           if (exactX < 0 || exactX > data.length * COL_WIDTH) return null;

           const mm = ev.time.getMinutes().toString().padStart(2, '0');
           const hh = ev.time.getHours().toString().padStart(2, '0');
           const isSunrise = ev.type === 'sunrise';
           const IconComp = isSunrise ? Sunrise : Sunset;
           const color = isSunrise ? 'var(--sunrise-color)' : 'var(--sunset-color)';

           return (
             <div key={`sun-${i}`} style={{
                position: 'absolute',
                left: `${exactX}px`,
                top: '34px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 21
             }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: color, whiteSpace: 'nowrap', fontWeight: 'bold', WebkitTextStroke: '2px var(--astro-label-stroke)', paintOrder: 'stroke fill' }}>
                   <IconComp size={10} color={color} /> {hh}:{mm}
                </div>
                <div style={{ height: '6px', width: '1px', backgroundColor: color, marginTop: '2px', opacity: 0.8 }} />
             </div>
           );
        })}

        {/* Moon Events Overlay */}
        {data.moonEvents && data.moonEvents.map((ev, i) => {
           if (ev.absoluteIndex == null) return null;
           const exactX = ev.absoluteIndex * COL_WIDTH + COL_WIDTH / 2;
           if (exactX < 0 || exactX > data.length * COL_WIDTH) return null;

           const mm = ev.time.getMinutes().toString().padStart(2, '0');
           const hh = ev.time.getHours().toString().padStart(2, '0');
           const isRise = ev.type === 'moonrise';
           const color = isRise ? 'var(--moonrise-color)' : 'var(--moonset-color)';
           const arrow = isRise ? '↑' : '↓';

           return (
             <div key={`moon-${i}`} style={{
                position: 'absolute',
                left: `${exactX}px`,
                top: '16px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20
             }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: color, whiteSpace: 'nowrap', fontWeight: 'bold', WebkitTextStroke: '2px var(--astro-label-stroke)', paintOrder: 'stroke fill' }}>
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
