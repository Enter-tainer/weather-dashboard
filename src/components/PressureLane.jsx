import { useEffect, useRef } from 'react';
import './Dashboard.css';

const COL_WIDTH = 22;

export default function PressureLane({ data, minP, maxP }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = data.length * COL_WIDTH;
    const height = 45; // --lane-height-pressure
    
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const getY = (p) => {
      if (maxP === minP) return height / 2;
      return height - 5 - ((p - minP) / (maxP - minP)) * (height - 10);
    };
    const getX = (index) => index * COL_WIDTH + COL_WIDTH / 2;

    // Detect location-change boundaries (break lines here)
    const isBreak = (i) => i > 0 && data[i].cityName !== data[i - 1].cityName;

    // Draw ensemble members
    const mCount = data[0]?.pressureMembers?.length || 0;
    if (mCount > 0) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(100, 100, 100, ${Math.max(0.04, 2.5 / mCount)})`;

      for (let mIdx = 0; mIdx < mCount; mIdx++) {
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = getX(i);
          const y = getY(data[i].pressureMembers[mIdx]);
          if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Draw main forecast line
    ctx.beginPath();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.9)';

    for (let i = 0; i < data.length; i++) {
       const x = getX(i);
       const y = getY(data[i].pressure);
       if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
       else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [data, minP, maxP]);

  return (
    <div className="lane pressure-lane" style={{ height: 'var(--lane-height-pressure)', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="lane-data">
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: `${data.length * COL_WIDTH}px`, height: 'var(--lane-height-pressure)' }} />
      </div>
    </div>
  );
}
