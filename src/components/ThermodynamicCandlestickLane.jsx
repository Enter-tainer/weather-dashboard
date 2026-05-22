import { useMemo } from 'react';
import { useCanvas } from '../hooks/useCanvas';

const COL_WIDTH = 22;
const LANE_HEIGHT = 88;
const TOP_PAD = 17;   // room for data pill above bars
const BOT_PAD = 13;   // room for humidity base below
const PLOT_H = LANE_HEIGHT - TOP_PAD - BOT_PAD; // 58
const BAR_W = 12;
const BAR_X = (COL_WIDTH - BAR_W) / 2; // 5

// ── Temperature color stops (same as existing) ──
const COLOR_STOPS = [
  [-20, 20, 30, 180],
  [0, 40, 120, 220],
  [15, 80, 180, 160],
  [25, 250, 180, 60],
  [40, 200, 50, 20],
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

// Luminance for text contrast
function tempLuminance(temp) {
  const t = Math.max(COLOR_STOPS[0][0], Math.min(COLOR_STOPS[COLOR_STOPS.length - 1][0], temp));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, r0, g0, b0] = COLOR_STOPS[i];
    const [t1, r1, g1, b1] = COLOR_STOPS[i + 1];
    if (t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      const r = lerp(r0, r1, ratio);
      const g = lerp(g0, g1, ratio);
      const b = lerp(b0, b1, ratio);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  const [, r, g, b] = COLOR_STOPS[COLOR_STOPS.length - 1];
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ── Ensemble helpers ──
function percentile(sorted, p) {
  if (!sorted || sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const k = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (k - lo) * (sorted[hi] - sorted[lo]);
}

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

function getEnsemble(d) {
  if (d.tempEnsemble) return d.tempEnsemble;
  return computeEnsemble(d.tempMembers);
}

export default function ThermodynamicCandlestickLane({ data, minTemp, maxTemp }) {
  const totalWidth = data.length * COL_WIDTH;
  const ensembles = useMemo(() => data.map(d => getEnsemble(d)), [data]);

  const tRange = maxTemp - minTemp || 1;
  const tempToY = (t) => TOP_PAD + PLOT_H * (1 - (t - minTemp) / tRange);
  const baselineY = TOP_PAD + PLOT_H;

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx, w, h) => {

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ens = ensembles[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      const bx = i * COL_WIDTH + BAR_X;

      const yTemp = tempToY(d.temperature);
      const barH = Math.max(2, baselineY - yTemp);

      // ── 1. Main temperature bar ──
      const color = tempColor(d.temperature);
      ctx.fillStyle = color;
      ctx.fillRect(bx, yTemp, BAR_W, barH);

      // ── 2. Dew point anchor (blue dot inside/on bar) ──
      const yDew = Math.min(baselineY - 2, Math.max(TOP_PAD, tempToY(d.dewPoint)));
      ctx.fillStyle = '#1565c0';
      ctx.beginPath();
      ctx.arc(cx, yDew, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // white ring for visibility on dark bars
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── 3. Feels-like marker ──
      const yApp = Math.min(baselineY - 2, Math.max(TOP_PAD, tempToY(d.apparentTemp)));
      const feelsDiff = d.apparentTemp - d.temperature;

      if (Math.abs(feelsDiff) >= 0.8) {
        const markerColor = feelsDiff > 0 ? '#e65100' : '#0277bd';

        // Connecting line (dashed) if marker floats above bar
        if (feelsDiff > 0 && yApp < yTemp - 3) {
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 0.7;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, yTemp);
          ctx.lineTo(cx, yApp + 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Horizontal tick
        ctx.strokeStyle = markerColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const tickW = feelsDiff < 0 ? 3 : 5; // narrower inside bar
        ctx.moveTo(cx - tickW, yApp);
        ctx.lineTo(cx + tickW, yApp);
        ctx.stroke();
      }

      // ── 4. Ensemble error bar (subtle I-beam) ──
      if (ens && ens.p10 != null && ens.p90 != null && ens.p10 !== ens.p90) {
        const y10 = Math.max(TOP_PAD, tempToY(ens.p10));
        const y90 = Math.min(baselineY, tempToY(ens.p90));
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, y10);
        ctx.lineTo(cx, y90);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 2, y10); ctx.lineTo(cx + 2, y10);
        ctx.moveTo(cx - 2, y90); ctx.lineTo(cx + 2, y90);
        ctx.stroke();
      }
    }

    // ── 5. Top data pills (every 3h) ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < data.length; i += 3) {
      const d = data[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      const feelsDiff = d.apparentTemp - d.temperature;

      // Temperature number (large, color-coded)
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = tempColor(d.temperature);
      ctx.fillText(`${Math.round(d.temperature)}°`, cx, TOP_PAD - 2);

      // Apparent temp offset indicator (right of temp)
      ctx.font = '7px system-ui';
      const appColor = Math.abs(feelsDiff) >= 2 ? '#d32f2f' : '#777';
      ctx.fillStyle = appColor;
      ctx.fillText(`体${Math.round(d.apparentTemp)}`, cx + 13, TOP_PAD - 2);
    }
    ctx.textBaseline = 'alphabetic';

    // ── 6. Bottom humidity base (every 3h) ──
    ctx.font = '8px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += 3) {
      const d = data[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      ctx.fillStyle = '#555';
      ctx.fillText(`${Math.round(d.humidity)}%|${Math.round(d.dewPoint)}°`, cx, LANE_HEIGHT - 2);
    }

  }, [data, minTemp, maxTemp, ensembles]);

  return (
    <div className="lane thermodynamic-lane" style={{ height: `${LANE_HEIGHT}px`, backgroundColor: 'transparent' }}>
      <div className="lane-data">
        <canvas
          ref={canvasRef}
          style={{ width: `${totalWidth}px`, height: `${LANE_HEIGHT}px`, display: 'block' }}
        />
      </div>
    </div>
  );
}
