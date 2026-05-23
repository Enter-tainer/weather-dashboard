import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
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

// Non-uniform Y-axis: equal height for low/mid/high cloud regions
// Breakpoints: [altitude_m, fraction_of_height_from_bottom]
const ALT_BREAKS = [
  [0, 0],
  [2000, 0.333],   // low clouds: 0-2km = 1/3
  [6000, 0.667],   // mid clouds: 2-6km = 1/3
  [10000, 1.0],    // high clouds: 6-10km = 1/3
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

// Grid lines at key altitudes matching the legend sidebar
const GRID_ALTS = [1000, 2000, 4000, 5000, 6000, 8000, 10000];
// Cloud classification boundaries get thicker lines
const BOUNDARY_ALTS = new Set([2000, 6000]);

// Precipitation color by weather code type
function precipColor(code, alpha = 0.6) {
  if ([95, 96, 99].includes(code)) return `rgba(${cssVar('--precip-thunder-rgb', '107, 33, 168')}, ${alpha})`;
  if ([56, 57, 66, 67].includes(code)) return `rgba(${cssVar('--precip-freezing-rgb', '139, 92, 246')}, ${alpha})`;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `rgba(${cssVar('--precip-snow-rgb', '56, 189, 248')}, ${alpha})`;
  if ([51, 53, 55].includes(code)) return `rgba(${cssVar('--precip-drizzle-rgb', '96, 165, 250')}, ${alpha})`;
  return `rgba(${cssVar('--precip-rain-rgb', '13, 71, 161')}, ${alpha})`;
}

function precipCssColor(code, alpha = 0.6) {
  if ([95, 96, 99].includes(code)) return `rgba(var(--precip-thunder-rgb), ${alpha})`;
  if ([56, 57, 66, 67].includes(code)) return `rgba(var(--precip-freezing-rgb), ${alpha})`;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `rgba(var(--precip-snow-rgb), ${alpha})`;
  if ([51, 53, 55].includes(code)) return `rgba(var(--precip-drizzle-rgb), ${alpha})`;
  return `rgba(var(--precip-rain-rgb), ${alpha})`;
}

// Uniform cloud color — only alpha varies with coverage
function cloudColor(cover, rgb, alphaScale) {
  const alpha = (cover / 100) * alphaScale;
  return `rgba(${rgb}, ${alpha})`;
}

export default function CloudAndRainLane({ data }) {
  const width = data.length * COL_WIDTH;

  const canvasRef = useCanvas(width, LANE_HEIGHT, (ctx, w, h) => {
    const cloudFillRgb = cssVar('--cloud-fill-rgb', '90, 90, 100');
    const cloudFillAlphaScale = Number.parseFloat(cssVar('--cloud-fill-alpha-scale', '0.85')) || 0.85;

    ctx.fillStyle = cssVar('--cloud-layer-bg', 'rgba(230, 232, 235, 0.3)');
    ctx.fillRect(0, 0, w, h);

    // Altitude grid lines (cloud boundaries thicker)
    for (const alt of GRID_ALTS) {
      const isBoundary = BOUNDARY_ALTS.has(alt);
      ctx.setLineDash(isBoundary ? [6, 4] : [4, 6]);
      ctx.strokeStyle = isBoundary
        ? cssVar('--cloud-grid-boundary', 'rgba(0,0,0,0.25)')
        : cssVar('--cloud-grid-line', 'rgba(0,0,0,0.12)');
      ctx.lineWidth = isBoundary ? 1.2 : 0.5;
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

          ctx.fillStyle = cloudColor(cover, cloudFillRgb, cloudFillAlphaScale);
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

          ctx.fillStyle = cloudColor(layer.cover, cloudFillRgb, cloudFillAlphaScale);
          ctx.fillRect(x, yTop, COL_WIDTH + 1, yBot - yTop);
        }
      }

      // Ensemble precipitation (background)
      if (d.precipMembers && d.precipMembers.length > 0) {
        ctx.fillStyle = `rgba(${cssVar('--precip-rain-rgb', '13, 71, 161')}, 0.08)`;
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
    ctx.strokeStyle = cssVar('--blh-line', 'rgba(180, 120, 60, 0.6)');
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
      <div className="lane-data" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, display: 'flex', zIndex: 2 }}>
          {data.map((item, index) => {
            const barHeight = item.precipitation > 0 ? Math.min(40, item.precipitation * 4) : 0;
            return (
              <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: `${barHeight + 2}px` }}>
                 {item.precipitation > 0 && (
                    <span style={{
                      color: precipCssColor(item.weatherCode, 1),
                      fontSize: '9px',
                      fontWeight: 'bold',
                      WebkitTextStroke: '2px var(--label-stroke)',
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
