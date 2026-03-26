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

// Pressure level labels shown as sticky overlays
const LEVEL_LABELS = [
  { pressure: 300, label: '300h 9km' },
  { pressure: 500, label: '500h 5km' },
  { pressure: 700, label: '700h 3km' },
  { pressure: 850, label: '850h 1.5km' },
];

// Map altitude (meters) to Y pixel (top = MAX_ALT, bottom = 0)
function altToY(alt) {
  return LANE_HEIGHT * (1 - Math.min(alt, MAX_ALT) / MAX_ALT);
}

// Windy-style cloud color: dense grays, high contrast
function cloudColor(alt, cover) {
  const t = Math.min(alt / MAX_ALT, 1);
  const v = Math.round(60 + t * 70); // 60 → 130
  const alpha = (cover / 100) * (0.95 - t * 0.1);
  return `rgba(${v}, ${v}, ${v + 10}, ${alpha})`;
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

    // Light background tint
    ctx.fillStyle = 'rgba(230, 232, 235, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Altitude grid lines (no canvas labels — they're in the sticky DOM overlay)
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    for (const { pressure } of LEVEL_LABELS) {
      const alt = FALLBACK_ALT[pressure];
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
        for (let li = 0; li < d.cloudByLevel.length - 1; li++) {
          const lower = d.cloudByLevel[li];
          const upper = d.cloudByLevel[li + 1];
          const cover = Math.max(lower.cover, upper.cover);
          if (cover < 3) continue;

          const altLow = lower.altitude ?? FALLBACK_ALT[lower.pressure];
          const altHigh = upper.altitude ?? FALLBACK_ALT[upper.pressure];
          const midAlt = (altLow + altHigh) / 2;

          const yTop = altToY(altHigh);
          const yBot = altToY(altLow);
          if (yBot - yTop <= 0) continue;

          // Flat fill, no edge gradient
          ctx.fillStyle = cloudColor(midAlt, cover);
          ctx.fillRect(x, yTop, COL_WIDTH + 1, yBot - yTop);
        }
      } else {
        // Fallback: use low/mid/high cloud cover
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

          ctx.fillStyle = cloudColor(midAlt, layer.cover);
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
        ctx.fillStyle = 'rgba(13, 71, 161, 0.5)';
        ctx.fillRect(x + COL_WIDTH / 2 - 4, height - barHeight, 8, barHeight);
      }
    }
  }, [data]);

  return (
    <div className="lane cloud-rain-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: `${data.length * COL_WIDTH}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }}
        />
        {/* Sticky pressure level labels */}
        {LEVEL_LABELS.map(({ pressure, label }) => {
          const y = altToY(FALLBACK_ALT[pressure]);
          return (
            <div
              key={pressure}
              style={{
                position: 'sticky', left: 0, width: 0, height: 0,
                zIndex: 10, pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute', top: `${y - 11}px`, left: '2px',
                fontSize: '8px', color: 'rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
                fontFamily: 'sans-serif',
              }}>
                {label}
              </div>
            </div>
          );
        })}
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
