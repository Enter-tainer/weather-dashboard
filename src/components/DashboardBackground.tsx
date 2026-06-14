import type { WeatherTimeline } from '../types/weather';
import { DEFAULT_HOUR_WIDTH, getTimelineWidth } from '../services/timelineLayout';
import './Dashboard.css';

interface DashboardBackgroundProps {
  data: WeatherTimeline;
  hourWidth?: number;
}

export default function DashboardBackground({ data, hourWidth = DEFAULT_HOUR_WIDTH }: DashboardBackgroundProps) {
  if (!data || data.length === 0) return null;

  const totalWidth = getTimelineWidth(data.length, hourWidth);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: totalWidth, zIndex: 0, pointerEvents: 'none' }}>
      {/* Night Bands */}
      {data.nightBands && data.nightBands.map((band, idx) => {
         const leftPx = band.left * hourWidth + hourWidth / 2;
         const rightPx = band.right * hourWidth + hourWidth / 2;
         return (
            <div key={`night-${idx}`} style={{ position: 'absolute', top: 0, left: `${leftPx}px`, width: `${rightPx - leftPx}px`, height: '100%', backgroundColor: 'var(--cell-night)' }} />
         );
      })}
      
      {/* Grid Lines */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' }}>
         {data.map((_, index) => (
            <div key={`grid-${index}`} style={{ width: `${hourWidth}px`, height: '100%', borderRight: '1px solid var(--grid-line)' }} />
         ))}
      </div>
    </div>
  );
}
