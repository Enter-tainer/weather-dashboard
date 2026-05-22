import { useMemo } from 'react';
import { useCanvas } from '../hooks/useCanvas';

const COL_WIDTH = 22;
const LANE_HEIGHT = 56;
const BAR_WIDTH = 12;
const BAR_PAD = (COL_WIDTH - BAR_WIDTH) / 2; // 5px each side

// Temperature color stops: cold blue → mild teal/green → hot orange/red
const COLOR_STOPS = [
  [-20, 20, 30, 180],   // deep blue (very cold)
  [0, 40, 120, 220],    // blue
  [15, 80, 180, 160],   // teal
  [25, 250, 180, 60],   // orange
  [40, 200, 50, 20],    // red (very hot)
];

function lerp(a, b, t) { return a + (b - a) * t; }

function tempColor(temp) {
  const t = Math.max(COLOR_STOPS[0][0], Math.min(COLOR_STOPS[COLOR_STOPS.length - 1][0], temp));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, r0, g0, b0] = COLOR_STOPS[i];
    const [t1, r1, g1, b1] = COLOR_STOPS[i + 1];
    if (t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(lerp(r0, r1, ratio))},${Math.round(lerp(g0, g1, ratio))},${Math.round(lerp(b0, b1, ratio))})`;
    }
  }
  const [, r, g, b] = COLOR_STOPS[COLOR_STOPS.length - 1];
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Compute percentile from a sorted array (linear interpolation)
function percentile(sorted, p) {
  if (!sorted || sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const k = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (k - lo) * (sorted[hi] - sorted[lo]);
}

// Compute ensemble percentiles from raw member array
function computeEnsemble(members) {
  if (!members || members.length === 0) return null;
  const sorted = [...members].sort((a, b) => a - b);
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

// Resolve ensemble data: prefer precomputed tempEnsemble, fall back to tempMembers
function getEnsemble(d) {
  if (d.tempEnsemble) return d.tempEnsemble;
  return computeEnsemble(d.tempMembers);
}

export default function TemperatureEnsembleLane({ data, minTemp, maxTemp }) {
  const totalWidth = data.length * COL_WIDTH;

  // Precompute ensembles so canvas draw doesn't sort on every re-render
  const ensembles = useMemo(() => data.map(d => getEnsemble(d)), [data]);

  const range = maxTemp - minTemp || 1;
  const barHeight = (temp) => Math.max(1, ((temp - minTemp) / range) * LANE_HEIGHT);
  const yFromTemp = (temp) => LANE_HEIGHT - barHeight(temp);

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx, w, h) => {
    const labelH = 12; // space reserved for text labels at top

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ens = ensembles[i];
      const x = i * COL_WIDTH + BAR_PAD;
      const cx = x + BAR_WIDTH / 2;

      // Use ensemble P50 if available, otherwise fall back to main temperature
      const temp = ens?.p50 != null ? ens.p50 : d.temperature;
      const bh = Math.max(2, barHeight(temp));

      // Draw temperature bar
      ctx.fillStyle = tempColor(temp);
      ctx.fillRect(x, h - bh, BAR_WIDTH, bh);

      // Error bar (I-beam) only if ensemble data is available
      if (ens && ens.p10 != null && ens.p90 != null && ens.p10 !== ens.p90) {
        const y10 = Math.max(labelH, yFromTemp(ens.p10));
        const y90 = Math.min(h - 1, yFromTemp(ens.p90));

        // Vertical line P10 → P90
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, y10);
        ctx.lineTo(cx, y90);
        ctx.stroke();

        // Horizontal caps at P10 and P90
        const capW = 3;
        ctx.beginPath();
        ctx.moveTo(cx - capW, y10);
        ctx.lineTo(cx + capW, y10);
        ctx.moveTo(cx - capW, y90);
        ctx.lineTo(cx + capW, y90);
        ctx.stroke();

        // P25-P75 thicker segment
        if (ens.p25 != null && ens.p75 != null) {
          const y25 = Math.max(labelH, yFromTemp(ens.p25));
          const y75 = Math.min(h - 1, yFromTemp(ens.p75));
          if (y25 !== y75) {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx, y25);
            ctx.lineTo(cx, y75);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
        }
      }
    }

    // Temperature labels every 3 hours at top of lane
    ctx.fillStyle = '#444';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += 3) {
      const ens = ensembles[i];
      const val = ens?.p50 != null ? ens.p50 : data[i].temperature;
      ctx.fillText(`${Math.round(val)}°`, i * COL_WIDTH + COL_WIDTH / 2, labelH - 1);
    }
  }, [data, minTemp, maxTemp, ensembles]);

  return (
    <div className="lane temp-ensemble-lane" style={{ height: `${LANE_HEIGHT}px`, backgroundColor: 'transparent' }}>
      <div className="lane-data">
        <canvas
          ref={canvasRef}
          style={{ width: `${totalWidth}px`, height: `${LANE_HEIGHT}px`, display: 'block' }}
        />
      </div>
    </div>
  );
}
