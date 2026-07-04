import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import { DEFAULT_HOUR_WIDTH, getHourCenter, getTimelineWidth } from '../services/timelineLayout';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

const LANE_HEIGHT = 50;

interface CloudEnsembleLaneProps {
  data: WeatherPoint[];
  hourWidth?: number;
}

export default function CloudEnsembleLane({ data, hourWidth = DEFAULT_HOUR_WIDTH }: CloudEnsembleLaneProps) {
  const width = getTimelineWidth(data.length, hourWidth);

  const canvasRef = useCanvas(width, LANE_HEIGHT, (ctx, w, h) => {
    const getY = (cov: number) => h - 5 - (cov / 100) * (h - 10);
    const getX = (index: number) => getHourCenter(index, hourWidth);

    // Detect location-change boundaries (break lines here)
    const isBreak = (i: number) => i > 0 && data[i]?.cityName !== data[i - 1]?.cityName;

    if (data[0]?.cloudMembers && data[0].cloudMembers.length > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 15;
      ctx.strokeStyle = cssVar('--cloud-ensemble-member-line', 'rgba(100, 100, 100, 0.05)');

      const numMembers = data[0].cloudMembers.length;
      for (let m = 0; m < numMembers; m++) {
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = getX(i);
          const cloudMember = data[i]?.cloudMembers?.[m];
          if (cloudMember == null) continue;
          const y = getY(cloudMember);
          if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Main Line
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = cssVar('--cloud-ensemble-main-line', 'rgba(80, 80, 80, 0.8)');
    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const item = data[i];
      if (!item || item.cloudCover == null) continue;
      const y = getY(item.cloudCover);
      if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [data, hourWidth]);

  return (
    <div className="lane cloud-ensemble-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative', borderBottom: '1px solid var(--lane-border)', backgroundColor: 'transparent' }}>
      <div className="lane-data" style={{ position: 'relative', width: `${width}px` }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px` }} />
      </div>
    </div>
  );
}
