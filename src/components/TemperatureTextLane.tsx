import type { WeatherPoint } from '../types/weather';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import './Dashboard.css';

interface TemperatureTextLaneProps {
  data: WeatherPoint[];
}

export default function TemperatureTextLane({ data }: TemperatureTextLaneProps) {
  const layout = useTimelineLayout(data.length);
  const labelInterval = 3;

  return (
    <div className="lane temp-text-lane" style={{ height: '35px', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => (
          <div
            key={index}
            className="lane-cell"
            style={{
              width: `${layout.getColumnWidth(index)}px`,
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {index % labelInterval === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{ fontWeight: 'bold', color: 'var(--color-temp-line)', fontSize: '12px' }}
                >
                  {item.temperature != null ? `${Math.round(item.temperature)}°` : '—'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                  {item.apparentTemp != null ? `${Math.round(item.apparentTemp)}°` : '—'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
