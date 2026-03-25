import { useEffect, useRef } from 'react';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 110;

export default function TemperatureLane({ data, minTemp, maxTemp }) {
  const canvasRef = useRef(null);
  
  const minTempVal = Math.floor(minTemp / 5) * 5;
  const maxTempVal = Math.ceil(maxTemp / 5) * 5;
  const tempSteps = [];
  if (minTemp !== Infinity) {
    for (let t = minTempVal; t <= maxTempVal; t += 5) {
      tempSteps.push(t);
    }
  }

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = data.length * COL_WIDTH;
    const height = LANE_HEIGHT;
    
    // Scale for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    
    const range = maxTemp - minTemp;
    if (range === 0) return;

    const getY = (val) => height - ((val - minTemp) / range) * height;
    const getX = (index) => index * COL_WIDTH + (COL_WIDTH / 2);

    // Draw gridlines
    ctx.beginPath();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    tempSteps.forEach(t => {
       const y = getY(t);
       if (y >= 10 && y <= height - 10) {
           ctx.moveTo(0, y);
           ctx.lineTo(width, y);
       }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Ensemble shadow bands (density effect)
    ctx.lineJoin = 'round';
    ctx.lineWidth = 15;
    ctx.strokeStyle = 'rgba(211, 47, 47, 0.05)'; 
    
    if (data[0].tempMembers && data[0].tempMembers.length > 0) {
      const numMembers = data[0].tempMembers.length;
      for (let m = 0; m < numMembers; m++) {
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = getX(i);
          const y = getY(data[i].tempMembers[m]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    
    // Draw Main Temperature Line
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c62828'; 
    
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(211, 47, 47, 0.3)');
    grad.addColorStop(1, 'rgba(211, 47, 47, 0.0)');
    
    ctx.lineTo(getX(0), height);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(data[i].temperature));
    }
    ctx.lineTo(getX(data.length - 1), height);
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Re-stroke main line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const y = getY(data[i].temperature);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [data, minTemp, maxTemp, tempSteps]);

  return (
    <div className="lane temp-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative' }}>
      <div className="lane-data">
        <canvas 
          ref={canvasRef} 
          style={{ position: 'absolute', top: 0, left: 0, width: `${data.length * COL_WIDTH}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }}
        />
      </div>
    </div>
  );
}
