import { useCanvas } from '../hooks/useCanvas';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 110;

interface TemperatureLaneProps {
  data: WeatherPoint[];
  minTemp: number;
  maxTemp: number;
}

export default function TemperatureLane({ data, minTemp, maxTemp }: TemperatureLaneProps) {
  const minTempVal = Math.floor(minTemp / 5) * 5;
  const maxTempVal = Math.ceil(maxTemp / 5) * 5;
  const tempSteps: number[] = [];
  if (minTemp !== Infinity) {
    for (let t = minTempVal; t <= maxTempVal; t += 5) {
      tempSteps.push(t);
    }
  }

  const width = data.length * COL_WIDTH;

  const canvasRef = useCanvas(width, LANE_HEIGHT, (ctx, w, h) => {
    const range = maxTemp - minTemp;
    if (range === 0) return;

    const getY = (val: number) => h - ((val - minTemp) / range) * h;
    const getX = (index: number) => index * COL_WIDTH + (COL_WIDTH / 2);

    // Draw gridlines
    ctx.beginPath();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    tempSteps.forEach(t => {
       const y = getY(t);
       if (y >= 10 && y <= h - 10) {
           ctx.moveTo(0, y);
           ctx.lineTo(w, y);
       }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Detect location-change boundaries (break lines here)
    const isBreak = (i: number) => i > 0 && data[i]?.cityName !== data[i - 1]?.cityName;

    // Draw Ensemble shadow bands (density effect)
    ctx.lineJoin = 'round';
    ctx.lineWidth = 15;
    ctx.strokeStyle = 'rgba(211, 47, 47, 0.05)';

    const firstTempMembers = data[0]?.tempMembers;
    if (firstTempMembers && firstTempMembers.length > 0) {
      const numMembers = firstTempMembers.length;
      for (let m = 0; m < numMembers; m++) {
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const tempMember = data[i]?.tempMembers?.[m];
          if (tempMember == null) continue;
          const x = getX(i);
          const y = getY(tempMember);
          if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Draw Main Temperature Line — gradient fill per segment
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c62828';

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(211, 47, 47, 0.3)');
    grad.addColorStop(1, 'rgba(211, 47, 47, 0.0)');
    ctx.fillStyle = grad;

    // Fill and stroke each contiguous segment separately
    let segStart = 0;
    for (let i = 0; i <= data.length; i++) {
      if (i === data.length || isBreak(i)) {
        // Fill segment [segStart, i-1]
        ctx.beginPath();
        const firstSegmentItem = data[segStart];
        if (!firstSegmentItem) continue;
        ctx.moveTo(getX(segStart), h);
        for (let j = segStart; j < i; j++) {
          const item = data[j];
          if (!item) continue;
          ctx.lineTo(getX(j), getY(item.temperature));
        }
        ctx.lineTo(getX(i - 1), h);
        ctx.fill();

        // Stroke segment
        ctx.beginPath();
        for (let j = segStart; j < i; j++) {
          const item = data[j];
          if (!item) continue;
          const x = getX(j);
          const y = getY(item.temperature);
          if (j === segStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        segStart = i;
      }
    }
  }, [data, minTemp, maxTemp, tempSteps]);

  return (
    <div className="lane temp-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative' }}>
      <div className="lane-data">
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }} />
      </div>
    </div>
  );
}
