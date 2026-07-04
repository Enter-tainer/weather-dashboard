import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import { DEFAULT_HOUR_WIDTH, getHourCenter, getTimelineWidth } from '../services/timelineLayout';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

interface PressureLaneProps {
  data: WeatherPoint[];
  minP: number;
  maxP: number;
  hourWidth?: number;
}

export default function PressureLane({
  data,
  minP,
  maxP,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: PressureLaneProps) {
  const width = getTimelineWidth(data.length, hourWidth);
  const height = 45; // --lane-height-pressure

  const canvasRef = useCanvas(
    width,
    height,
    (ctx, w, h) => {
      const getY = (p: number) => {
        if (maxP === minP) return h / 2;
        return h - 5 - ((p - minP) / (maxP - minP)) * (h - 10);
      };
      const getX = (index: number) => getHourCenter(index, hourWidth);

      // Detect location-change boundaries (break lines here)
      const isBreak = (i: number) => i > 0 && data[i]?.cityName !== data[i - 1]?.cityName;

      // Draw ensemble members
      const mCount = data[0]?.pressureMembers?.length || 0;
      if (mCount > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${cssVar('--chart-line-rgb', '100, 100, 100')}, ${Math.max(0.04, 2.5 / mCount)})`;

        for (let mIdx = 0; mIdx < mCount; mIdx++) {
          ctx.beginPath();
          for (let i = 0; i < data.length; i++) {
            const x = getX(i);
            const memberPressure = data[i]?.pressureMembers?.[mIdx];
            if (memberPressure == null) continue;
            const y = getY(memberPressure);
            if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // Draw main forecast line
      ctx.beginPath();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = cssVar('--chart-line-main', 'rgba(50, 50, 50, 0.9)');

      let started = false;
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item || item.pressure == null) {
          started = false;
          continue;
        }
        const x = getX(i);
        const y = getY(item.pressure);
        if (!started || isBreak(i)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        started = true;
      }
      ctx.stroke();
    },
    [data, minP, maxP, hourWidth],
  );

  return (
    <div
      className="lane pressure-lane"
      style={{
        height: 'var(--lane-height-pressure)',
        position: 'relative',
        borderBottom: '1px solid var(--lane-border)',
      }}
    >
      <div className="lane-data">
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: 'var(--lane-height-pressure)',
          }}
        />
      </div>
    </div>
  );
}
