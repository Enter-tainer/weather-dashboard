import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

interface CapeLaneProps {
  data: WeatherPoint[];
}

export default function CapeLane({ data }: CapeLaneProps) {
  // CAPE J/kg ranges. Usually <1000 is mild, 1000-2000 is moderate, >2000 is severe
  const getCapeColor = (cape: number): string => {
    if (cape < 100) return 'transparent';
    if (cape < 500) return 'var(--cape-low-bg)';
    if (cape < 1000) return 'var(--cape-mid-bg)';
    if (cape < 2000) return 'var(--cape-high-bg)';
    return 'var(--cape-severe-bg)';
  };

  return (
    <div className="lane cape-lane" style={{ height: 'var(--lane-height-cape)', backgroundColor: 'transparent', borderBottom: '1px solid var(--lane-border)' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const cape = item.cape;
           const bgColor = getCapeColor(cape);
           return (
             <div key={index} className="lane-cell" style={{ backgroundColor: bgColor, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
               {cape > 0 && (
                 <span style={{ fontSize: '8px', color: 'var(--metric-text-strong)', fontWeight: 'bold' }}>{Math.round(cape)}</span>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
