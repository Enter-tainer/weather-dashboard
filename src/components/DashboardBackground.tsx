import type { WeatherTimeline } from '../types/weather';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import './Dashboard.css';

interface DashboardBackgroundProps {
  data: WeatherTimeline;
  hourWidth?: number;
}

export default function DashboardBackground({
  data,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: DashboardBackgroundProps) {
  const layout = useTimelineLayout(data.length, hourWidth);
  if (!data || data.length === 0) return null;

  const totalWidth = layout.totalWidth;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: totalWidth,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Night Bands */}
      {data.nightBands &&
        data.nightBands.map((band, idx) => {
          const leftPx = layout.getTimePosition(band.left);
          const rightPx = layout.getTimePosition(band.right);
          return (
            <div
              key={`night-${idx}`}
              style={{
                position: 'absolute',
                top: 0,
                left: `${leftPx}px`,
                width: `${rightPx - leftPx}px`,
                height: '100%',
                backgroundColor: 'var(--cell-night)',
              }}
            />
          );
        })}

      {/* Grid Lines */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
        }}
      >
        {data.map((_, index) => (
          <div
            key={`grid-${index}`}
            style={{
              width: `${layout.getColumnWidth(index)}px`,
              flexShrink: 0,
              boxSizing: 'border-box',
              height: '100%',
              borderLeft: '1px solid var(--grid-line)',
              borderRight: index === data.length - 1 ? '1px solid var(--grid-line)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
