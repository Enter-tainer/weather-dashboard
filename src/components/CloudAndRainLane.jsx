import { useEffect, useRef } from 'react';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 150;

export default function CloudAndRainLane({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = data.length * COL_WIDTH;
    const height = LANE_HEIGHT;
    
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    const getX = (index) => index * COL_WIDTH;

    // Grid lines for layers
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.moveTo(0, 30); ctx.lineTo(width, 30);
    ctx.moveTo(0, 70); ctx.lineTo(width, 70);
    ctx.moveTo(0, 110); ctx.lineTo(width, 110);
    ctx.stroke();
    ctx.setLineDash([]);

    // 1. Draw deterministic cloud coverage blocks
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const x = getX(i);
      
      const highAlpha = d.cloudHigh / 100 * 0.8;
      ctx.fillStyle = `rgba(180, 180, 190, ${highAlpha})`;
      ctx.fillRect(x, 0, COL_WIDTH + 1, 30);
      
      const midAlpha = d.cloudMid / 100 * 0.9;
      ctx.fillStyle = `rgba(150, 150, 160, ${midAlpha})`;
      ctx.fillRect(x, 30, COL_WIDTH + 1, 40);

      const lowAlpha = d.cloudLow / 100;
      ctx.fillStyle = `rgba(100, 100, 110, ${lowAlpha})`;
      ctx.fillRect(x, 70, COL_WIDTH + 1, 40);
      
      // Ensemble Inked Precipitation
      if (d.precipMembers && d.precipMembers.length > 0) {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.05)';
        d.precipMembers.forEach(precip => {
          if (precip > 0.1) {
            const barHeight = Math.min(40, precip * 4); 
            ctx.fillRect(x, height - barHeight, COL_WIDTH, barHeight);
          }
        });
      }

      // Main Deterministic Precipitation bar
      if (d.precipitation > 0) {
        const barHeight = Math.min(40, d.precipitation * 4); 
        ctx.fillStyle = 'rgba(13, 71, 161, 0.4)'; 
        ctx.fillRect(x + COL_WIDTH/2 - 4, height - barHeight, 8, barHeight);
      }
    }
  }, [data]);

  return (
    <div className="lane cloud-rain-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative' }}>
      <div className="lane-data">
        <canvas 
          ref={canvasRef} 
          style={{ position: 'absolute', top: 0, left: 0, width: `${data.length * COL_WIDTH}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${data.length * COL_WIDTH}px`, height: `${LANE_HEIGHT}px`, display: 'flex', zIndex: 2 }}>
          {data.map((item, index) => (
            <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '45px' }}>
               {item.precipitation > 0 && (
                  <span style={{ color: '#0d47a1', fontSize: '9px', fontWeight: 'bold' }}>
                    {item.precipitation.toFixed(1)}
                  </span>
               )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
