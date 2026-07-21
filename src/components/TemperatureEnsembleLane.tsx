import { useMemo } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import type { TemperatureEnsemble, WeatherPoint } from '../types/weather';

const LANE_HEIGHT = 56;

// Temperature color stops: cold blue → mild teal/green → hot orange/red
type ColorStop = readonly [temp: number, r: number, g: number, b: number];

const COLOR_STOPS = [
  [-20, 20, 30, 180], // deep blue (very cold)
  [0, 40, 120, 220], // blue
  [15, 80, 180, 160], // teal
  [25, 250, 180, 60], // orange
  [40, 200, 50, 20], // red (very hot)
] as const satisfies readonly ColorStop[];

const FIRST_STOP = COLOR_STOPS[0];
const LAST_STOP = COLOR_STOPS[4];

interface TemperatureEnsembleLaneProps {
  data: WeatherPoint[];
  minTemp: number;
  maxTemp: number;
  hourWidth?: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function tempColor(temp: number): string {
  const t = Math.max(FIRST_STOP[0], Math.min(LAST_STOP[0], temp));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const current = COLOR_STOPS[i];
    const next = COLOR_STOPS[i + 1];
    if (!current || !next) continue;
    const [t0, r0, g0, b0] = current;
    const [t1, r1, g1, b1] = next;
    if (t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(lerp(r0, r1, ratio))},${Math.round(lerp(g0, g1, ratio))},${Math.round(lerp(b0, b1, ratio))})`;
    }
  }
  const [, r, g, b] = LAST_STOP;
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Pick text color based on bar background luminance (light bar → dark text, dark bar → white)
function tempTextColor(temp: number): string {
  const t = Math.max(FIRST_STOP[0], Math.min(LAST_STOP[0], temp));
  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const current = COLOR_STOPS[i];
    const next = COLOR_STOPS[i + 1];
    if (!current || !next) continue;
    const [t0, r0, g0, b0] = current;
    const [t1, r1, g1, b1] = next;
    if (t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      r = lerp(r0, r1, ratio);
      g = lerp(g0, g1, ratio);
      b = lerp(b0, b1, ratio);
      break;
    }
  }
  if (r == null) {
    [, r, g, b] = LAST_STOP;
  }
  if (g == null || b == null) return '#fff';
  // Perceived luminance: 0.299R + 0.587G + 0.114B
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 140 ? '#333' : '#fff';
}

// Compute percentile from a sorted array (linear interpolation)
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const k = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  const low = sorted[lo];
  const high = sorted[hi];
  if (low == null || high == null) return null;
  if (lo === hi) return low;
  return low + (k - lo) * (high - low);
}

// Compute ensemble percentiles from raw member array
function computeEnsemble(members: number[] | undefined): TemperatureEnsemble | null {
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
function getEnsemble(d: WeatherPoint): TemperatureEnsemble | null {
  if (d.tempEnsemble) return d.tempEnsemble;
  return computeEnsemble(d.tempMembers);
}

export default function TemperatureEnsembleLane({
  data,
  minTemp,
  maxTemp,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: TemperatureEnsembleLaneProps) {
  const layout = useTimelineLayout(data.length, hourWidth);
  const totalWidth = layout.totalWidth;
  const barWidth = Math.max(2, Math.min(12, hourWidth * 0.7));
  const labelInterval = hourWidth < 12 ? 6 : 2;

  // Precompute ensembles so canvas draw doesn't sort on every re-render
  const ensembles = useMemo(() => data.map((d) => getEnsemble(d)), [data]);

  const hasTempScale = Number.isFinite(minTemp) && Number.isFinite(maxTemp);
  const rawRange = maxTemp - minTemp;
  const range = Number.isFinite(rawRange) && rawRange !== 0 ? rawRange : 1;
  const barHeight = (temp: number) => Math.max(1, ((temp - minTemp) / range) * LANE_HEIGHT);
  const yFromTemp = (temp: number) => LANE_HEIGHT - barHeight(temp);

  const canvasRef = useCanvas(
    totalWidth,
    LANE_HEIGHT,
    (ctx, w, h) => {
      if (!hasTempScale) return;

      const labelH = 12; // space reserved for text labels at top

      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (!d || d.temperature == null) continue;
        const ens = ensembles[i];
        const cx = layout.getColumnCenter(i);
        const x = cx - barWidth / 2;

        // Use main forecast temperature for bar height (matches TemperatureTextLane above)
        const temp = d.temperature;
        const bh = Math.max(2, barHeight(temp));

        // Draw temperature bar
        ctx.fillStyle = tempColor(temp);
        ctx.fillRect(x, h - bh, barWidth, bh);

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

      // Temperature value labels at bottom of lane (every 2h)
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < data.length; i++) {
        if (!layout.isExpandedColumn(i) && i % labelInterval !== 0) continue;
        const item = data[i];
        if (!item || item.temperature == null) continue;
        const temp = item.temperature;
        const text = `${Math.round(temp)}`;
        const tx = layout.getColumnCenter(i);
        const ty = h - 3;
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = tempTextColor(temp);
        ctx.fillText(text, tx, ty);
      }
    },
    [data, minTemp, maxTemp, hasTempScale, ensembles, layout, barWidth, labelInterval],
  );

  return (
    <div
      className="lane temp-ensemble-lane"
      style={{ height: `${LANE_HEIGHT}px`, backgroundColor: 'transparent' }}
    >
      <div className="lane-data">
        <canvas
          ref={canvasRef}
          style={{ width: `${totalWidth}px`, height: `${LANE_HEIGHT}px`, display: 'block' }}
        />
      </div>
    </div>
  );
}
