import { useEffect, useRef } from 'react';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 150;
const MAX_ALT = 10000; // meters

// Fallback altitudes (meters) when geopotential height is unavailable
const FALLBACK_ALT = {
  1000: 100, 925: 750, 850: 1500, 700: 3000,
  600: 4200, 500: 5500, 400: 7200, 300: 9000,
};

// Map altitude (meters) to Y pixel (top = MAX_ALT, bottom = 0)
function altToY(alt) {
  return LANE_HEIGHT * (1 - alt / MAX_ALT);
}

// Interpolate color: higher clouds are lighter/bluer, lower clouds are darker/grayer
function cloudColor(alt, cover) {
  const t = Math.min(alt / MAX_ALT, 1); // 0 = ground, 1 = high
  // Low clouds: dark gray-blue. High clouds: light silver-blue.
  const r = Math.round(120 + t * 60);   // 120 → 180
  const g = Math.round(120 + t * 60);   // 120 → 180
  const b = Math.round(140 + t * 50);   // 140 → 190
  const alpha = (cover / 100) * (0.85 - t * 0.3); // lower clouds more opaque
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

    // Altitude grid lines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (const alt of [2000, 4000, 6000, 8000]) {
      const y = altToY(alt);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw cloud layers for each hour
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const x = i * COL_WIDTH;

      if (d.cloudByLevel) {
        // Use pressure-level data with actual altitudes
        for (let li = 0; li < d.cloudByLevel.length - 1; li++) {
          const lower = d.cloudByLevel[li];
          const upper = d.cloudByLevel[li + 1];
          const cover = Math.max(lower.cover, upper.cover);
          if (cover < 3) continue; // skip negligible coverage

          const altLow = Math.min(lower.altitude ?? FALLBACK_ALT[lower.pressure], MAX_ALT);
          const altHigh = Math.min(upper.altitude ?? FALLBACK_ALT[upper.pressure], MAX_ALT);
          const midAlt = (altLow + altHigh) / 2;

          const yTop = altToY(altHigh);
          const yBot = altToY(altLow);
          const layerH = yBot - yTop;
          if (layerH <= 0) continue;

          // Soft watercolor gradient: peak opacity in center, fading at edges
          const grad = ctx.createLinearGradient(0, yTop, 0, yBot);
          const baseColor = cloudColor(midAlt, cover);
          const fadeColor = cloudColor(midAlt, cover * 0.2);
          grad.addColorStop(0, fadeColor);
          grad.addColorStop(0.3, baseColor);
          grad.addColorStop(0.7, baseColor);
          grad.addColorStop(1, fadeColor);

          ctx.fillStyle = grad;
          // Extend 1px right for seamless columns
          ctx.fillRect(x, yTop, COL_WIDTH + 1, layerH);
        }
      } else {
        // Fallback: use low/mid/high cloud cover with standard altitude ranges
        const layers = [
          { cover: d.cloudLow, altLow: 0, altHigh: 2000 },
          { cover: d.cloudMid, altLow: 2000, altHigh: 6000 },
          { cover: d.cloudHigh, altLow: 6000, altHigh: 10000 },
        ];
        for (const layer of layers) {
          if (layer.cover < 3) continue;
          const midAlt = (layer.altLow + layer.altHigh) / 2;
          const yTop = altToY(layer.altHigh);
          const yBot = altToY(layer.altLow);

          const grad = ctx.createLinearGradient(0, yTop, 0, yBot);
          const baseColor = cloudColor(midAlt, layer.cover);
          const fadeColor = cloudColor(midAlt, layer.cover * 0.2);
          grad.addColorStop(0, fadeColor);
          grad.addColorStop(0.3, baseColor);
          grad.addColorStop(0.7, baseColor);
          grad.addColorStop(1, fadeColor);

          ctx.fillStyle = grad;
          ctx.fillRect(x, yTop, COL_WIDTH + 1, yBot - yTop);
        }
      }

      // Ensemble precipitation (background)
      if (d.precipMembers && d.precipMembers.length > 0) {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.05)';
        d.precipMembers.forEach(precip => {
          if (precip > 0.1) {
            const barHeight = Math.min(40, precip * 4);
            ctx.fillRect(x, height - barHeight, COL_WIDTH, barHeight);
          }
        });
      }

      // Main precipitation bar
      if (d.precipitation > 0) {
        const barHeight = Math.min(40, d.precipitation * 4);
        ctx.fillStyle = 'rgba(13, 71, 161, 0.4)';
        ctx.fillRect(x + COL_WIDTH / 2 - 4, height - barHeight, 8, barHeight);
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
