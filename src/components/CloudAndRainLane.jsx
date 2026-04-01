import { useCanvas } from '../hooks/useCanvas';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 150;
const MAX_ALT = 10000; // meters

// Fallback altitudes (meters) when geopotential height is unavailable
const FALLBACK_ALT = {
  1000: 110, 975: 320, 950: 500, 925: 800, 900: 1000,
  850: 1500, 800: 1900, 700: 3000, 600: 4200,
  500: 5600, 400: 7200, 300: 9200,
};

// Non-uniform Y-axis: expand 0-1km region for boundary layer detail
// Breakpoints: [altitude_m, fraction_of_height_from_bottom]
const ALT_BREAKS = [
  [0, 0],
  [1000, 0.40],   // 0-1km occupies bottom 40%
  [3000, 0.65],   // 1-3km occupies next 25%
  [10000, 1.0],   // 3-10km occupies top 35%
];

// Map altitude (meters) to Y pixel using piecewise linear scale
function altToY(alt) {
  const a = Math.min(Math.max(alt, 0), MAX_ALT);
  for (let i = 0; i < ALT_BREAKS.length - 1; i++) {
    const [a0, f0] = ALT_BREAKS[i];
    const [a1, f1] = ALT_BREAKS[i + 1];
    if (a <= a1) {
      const frac = f0 + (f1 - f0) * (a - a0) / (a1 - a0);
      return LANE_HEIGHT * (1 - frac);
    }
  }
  return 0;
}

// Pressure level labels shown as sticky overlays
const LEVEL_LABELS = [
  { pressure: 300, label: '300h 9km' },
  { pressure: 500, label: '500h 5km' },
  { pressure: 700, label: '700h 3km' },
  { pressure: 850, label: '850h 1.5km' },
  { pressure: 950, label: '950h 0.5km' },
];

// Precipitation color by weather code type
function precipColor(code, alpha = 0.6) {
  if ([95, 96, 99].includes(code)) return `rgba(107, 33, 168, ${alpha})`; // thunderstorm — purple
  if ([56, 57, 66, 67].includes(code)) return `rgba(139, 92, 246, ${alpha})`; // freezing — violet
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `rgba(56, 189, 248, ${alpha})`; // snow — light blue
  if ([51, 53, 55].includes(code)) return `rgba(96, 165, 250, ${alpha})`; // drizzle — medium blue
  return `rgba(13, 71, 161, ${alpha})`; // rain (default) — dark blue
}

// Uniform cloud color — only alpha varies with coverage
function cloudColor(cover) {
  const alpha = (cover / 100) * 0.85;
  return `rgba(90, 90, 100, ${alpha})`;
}

export default function CloudAndRainLane({ data }) {
  const width = data.length * COL_WIDTH;

  const canvasRef = useCanvas(width, LANE_HEIGHT, (ctx, w, h) => {
    // Light background tint
    ctx.fillStyle = 'rgba(230, 232, 235, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // Altitude grid lines
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    for (const { pressure } of LEVEL_LABELS) {
      const alt = FALLBACK_ALT[pressure];
      const y = altToY(alt);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
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

          const yTop = altToY(altHigh);
          const yBot = altToY(altLow);
          if (yBot - yTop <= 0) continue;

          ctx.fillStyle = cloudColor(cover);
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
          const yTop = altToY(layer.altHigh);
          const yBot = altToY(layer.altLow);

          ctx.fillStyle = cloudColor(layer.cover);
          ctx.fillRect(x, yTop, COL_WIDTH + 1, yBot - yTop);
        }
      }

      // Ensemble precipitation (background)
      if (d.precipMembers && d.precipMembers.length > 0) {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.05)';
        d.precipMembers.forEach(precip => {
          if (precip > 0.1) {
            const barHeight = Math.min(40, precip * 4);
            ctx.fillRect(x, h - barHeight, COL_WIDTH, barHeight);
          }
        });
      }

      // Main precipitation bar — colored by type
      if (d.precipitation > 0) {
        const barHeight = Math.min(40, d.precipitation * 4);
        ctx.fillStyle = precipColor(d.weatherCode, 0.5);
        ctx.fillRect(x + COL_WIDTH / 2 - 4, h - barHeight, 8, barHeight);
      }
    }

    // Boundary layer height — dashed line across all hours
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(180, 120, 60, 0.6)';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < data.length; i++) {
      const blh = data[i].boundaryLayerHeight;
      if (blh == null) { started = false; continue; }
      const x = i * COL_WIDTH + COL_WIDTH / 2;
      const y = altToY(blh);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }, [data]);

  return (
    <div className="lane cloud-rain-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative' }}>
      {/* Sticky pressure level labels — must be direct children of .lane for sticky to work */}
      <div style={{ position: 'sticky', left: 0, width: 0, height: 0, zIndex: 10, pointerEvents: 'none', flexShrink: 0 }}>
        {LEVEL_LABELS.map(({ pressure, label }) => {
          const y = altToY(FALLBACK_ALT[pressure]);
          return (
            <div
              key={pressure}
              style={{
                position: 'absolute', top: `${y - 11}px`, left: '2px',
                fontSize: '8px', color: 'rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
                fontFamily: 'sans-serif',
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
      <div className="lane-data" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, display: 'flex', zIndex: 2 }}>
          {data.map((item, index) => {
            const barHeight = item.precipitation > 0 ? Math.min(40, item.precipitation * 4) : 0;
            return (
              <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: `${barHeight + 2}px` }}>
                 {item.precipitation > 0 && (
                    <span style={{
                      color: precipColor(item.weatherCode, 1),
                      fontSize: '9px',
                      fontWeight: 'bold',
                      WebkitTextStroke: '2px white',
                      paintOrder: 'stroke fill'
                    }}>
                      {item.precipitation.toFixed(1)}
                    </span>
                 )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
