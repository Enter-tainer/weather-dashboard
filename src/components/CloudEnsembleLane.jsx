import { useLayoutEffect, useRef } from 'react';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 50;

export default function CloudEnsembleLane({ data }) {
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = data.length * COL_WIDTH;
    const height = LANE_HEIGHT;
    
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);

    const getY = (cov) => height - 5 - (cov / 100) * (height - 10);
    const getX = (index) => index * COL_WIDTH + COL_WIDTH / 2;

    // Detect location-change boundaries (break lines here)
    const isBreak = (i) => i > 0 && data[i].cityName !== data[i - 1].cityName;

    if (data[0].cloudMembers && data[0].cloudMembers.length > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 15;
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.05)';

      const numMembers = data[0].cloudMembers.length;
      for (let m = 0; m < numMembers; m++) {
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = getX(i);
          const y = getY(data[i].cloudMembers[m]);
          if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Main Line
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(80, 80, 80, 0.8)';
    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const y = getY(data[i].cloudCover);
      if (i === 0 || isBreak(i)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [data]);

  return (
    <div className="lane cloud-ensemble-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.05)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        <canvas 
          ref={canvasRef} 
          style={{ position: 'absolute', top: 0, left: 0, width: `${data.length * COL_WIDTH}px`, height: `${LANE_HEIGHT}px` }}
        />
      </div>
    </div>
  );
}
