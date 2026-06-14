import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

interface TemperatureTextLaneProps {
  data: WeatherPoint[];
}

export default function TemperatureTextLane({ data }: TemperatureTextLaneProps) {
  const labelInterval = 3;

  return (
    <div className="lane temp-text-lane" style={{ height: '35px', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => (
          <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center' }}>
             {index % labelInterval === 0 && (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <span style={{ fontWeight: 'bold', color: 'var(--color-temp-line)', fontSize: '12px' }}>{Math.round(item.temperature)}°</span>
                 <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{Math.round(item.apparentTemp)}°</span>
               </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
