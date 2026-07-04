import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

interface HumidityLaneProps {
  data: WeatherPoint[];
}

export default function HumidityLane({ data }: HumidityLaneProps) {
  return (
    <div className="lane humidity-lane" style={{ height: 'var(--lane-height-humidity)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => (
          <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center' }}>
             {index % 3 === 0 && item.humidity != null && (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <span style={{ fontWeight: 'bold', color: 'var(--precip-prob-60)', fontSize: '12px' }}>{Math.round(item.humidity)}%</span>
                 <span style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '-1px' }}>
                   {item.dewPoint != null ? `${Math.round(item.dewPoint)}°` : '—'}
                 </span>
               </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
