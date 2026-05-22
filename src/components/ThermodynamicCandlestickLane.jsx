import { useMemo } from 'react';
import { useCanvas } from '../hooks/useCanvas';

const COL_WIDTH = 22;
const LANE_HEIGHT = 80;
const TOP_LABEL_H = 13;
const BOT_LABEL_H = 12;
const BAR_TOP = TOP_LABEL_H;
const BAR_BOT = LANE_HEIGHT - BOT_LABEL_H;
const BAR_H_MAX = BAR_BOT - BAR_TOP;
const BAR_W = 12;
const BAR_X = (COL_WIDTH - BAR_W) / 2;

// ── Temperature color stops ──
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

function tempLuminance(temp) {
  const t = Math.max(COLOR_STOPS[0][0], Math.min(COLOR_STOPS[COLOR_STOPS.length - 1][0], temp));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, r0, g0, b0] = COLOR_STOPS[i];
    const [t1, r1, g1, b1] = COLOR_STOPS[i + 1];
    if (t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      return 0.299 * lerp(r0, r1, ratio) + 0.587 * lerp(g0, g1, ratio) + 0.114 * lerp(b0, b1, ratio);
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
  const tempToY = (t) => BAR_BOT - ((t - minTemp) / tRange) * BAR_H_MAX;

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx, w, h) => {

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ens = ensembles[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      const bx = i * COL_WIDTH + BAR_X;

      const yTemp = tempToY(d.temperature);
      const barH = Math.max(2, BAR_BOT - yTemp);

      // ── Temperature bar ──
      ctx.fillStyle = tempColor(d.temperature);
      ctx.fillRect(bx, yTemp, BAR_W, barH);

      // ── Dew point (tiny dot) ──
      const yDew = Math.min(BAR_BOT - 2, Math.max(BAR_TOP + 2, tempToY(d.dewPoint)));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, yDew, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1565c0';
      ctx.beginPath();
      ctx.arc(cx, yDew, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // ── Feels-like side notch at apparent temp ──
      const yApp = tempToY(d.apparentTemp);
      const feelsDiff = d.apparentTemp - d.temperature;
      if (Math.abs(feelsDiff) >= 0.8 && yApp >= BAR_TOP && yApp <= BAR_BOT) {
        const isWarmer = feelsDiff > 0;
        ctx.fillStyle = isWarmer ? '#e65100' : '#0277bd';
        // Small triangle notch on left side of bar
        ctx.beginPath();
        ctx.moveTo(bx - 1, yApp - 2);
        ctx.lineTo(bx - 1, yApp + 2);
        ctx.lineTo(bx - 5, yApp);
        ctx.closePath();
        ctx.fill();
      }

      // ── Ensemble I-beam error bar ──
      if (ens && ens.p10 != null && ens.p90 != null && ens.p10 !== ens.p90) {
        const y10 = Math.max(BAR_TOP, tempToY(ens.p10));
        const y90 = Math.min(BAR_BOT, tempToY(ens.p90));
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
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

    // ── Top labels: temperature + apparent temp (every 3h) ──
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += 3) {
      const d = data[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      const lum = tempLuminance(d.temperature);

      // Main temperature
      ctx.font = 'bold 10px system-ui';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = lum > 140 ? '#222' : '#fff';
      ctx.fillText(`${Math.round(d.temperature)}°`, cx, TOP_LABEL_H - 2);

      // Apparent temp (small, below main temp, only if differs meaningfully)
      const feelsDiff = d.apparentTemp - d.temperature;
      if (Math.abs(feelsDiff) >= 0.8) {
        ctx.font = '7px system-ui';
        ctx.textBaseline = 'top';
        ctx.fillStyle = Math.abs(feelsDiff) >= 2
          ? (feelsDiff > 0 ? '#e65100' : '#0277bd')
          : '#888';
        ctx.fillText(`${Math.round(d.apparentTemp)}°`, cx, TOP_LABEL_H - 1);
      }
    }
    ctx.textBaseline = 'alphabetic';

    // ── Bottom labels: humidity every 3h ──
    ctx.font = '8px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += 3) {
      const d = data[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      ctx.fillStyle = '#666';
      ctx.fillText(`${Math.round(d.humidity)}%`, cx, LANE_HEIGHT - 2);
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
