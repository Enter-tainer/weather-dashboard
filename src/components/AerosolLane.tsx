import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import { DEFAULT_HOUR_WIDTH, getHourCenter, getHourLeft, getTimelineWidth } from '../services/timelineLayout';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

const LANE_HEIGHT = 30;
const MAX_AOD = 1.5;

// Sky-appearance gradient: continuous interpolation between key color stops
// Reflects actual atmospheric appearance at each AOD level
type ColorStop = readonly [aod: number, r: number, g: number, b: number, a: number];
type ColorStops = readonly [ColorStop, ...ColorStop[]];

const BG_STOPS = [
  // [aod, r, g, b, a]
  [0.0,  28, 169, 201, 0.35],  // crystal blue sky
  [0.1, 135, 206, 235, 0.40],  // normal clear day
  [0.25, 185, 215, 232, 0.42], // fading blue
  [0.45, 210, 218, 226, 0.45], // milky white haze
  [0.65, 200, 185, 155, 0.50], // hazy khaki
  [1.0, 166, 123,  91, 0.55],  // dust brown
  [1.5, 139,  69,  19, 0.60],  // apocalyptic
] as const satisfies ColorStops;

const BAR_STOPS = [
  [0.0,   70, 150, 180, 0.45],
  [0.25,  70, 150, 180, 0.50],
  [0.45, 160, 170, 180, 0.55],
  [0.8,  180, 155, 110, 0.65],
  [1.5,  120,  55,  15, 0.85],
] as const satisfies ColorStops;

interface AerosolLaneProps {
  data: WeatherPoint[];
  hourWidth?: number;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function interpolate(stops: ColorStops, aod: number): ColorStop {
  if (aod <= stops[0][0]) return stops[0];
  const last = stops[stops.length - 1] ?? stops[0];
  if (aod >= last[0]) return last;
  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];
    if (!current || !next) continue;

    if (aod <= next[0]) {
      const t = (aod - current[0]) / (next[0] - current[0]);
      return [
        aod,
        lerp(current[1], next[1], t),
        lerp(current[2], next[2], t),
        lerp(current[3], next[3], t),
        lerp(current[4], next[4], t),
      ];
    }
  }
  return last;
}

function aodColor(aod: number | null | undefined): string {
  if (aod == null) return 'transparent';
  const [, r, g, b, a] = interpolate(BG_STOPS, aod);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

function aodBarColor(aod: number): string {
  const [, r, g, b, a] = interpolate(BAR_STOPS, aod);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

function getAodTextStyle(): { fill: string; stroke: string } {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return {
    fill: cssVar('--aod-text', isDark ? '#ffffff' : '#111111'),
    stroke: cssVar('--aod-text-stroke', isDark ? '#000000' : 'rgba(255,255,255,0.85)'),
  };
}

export default function AerosolLane({
  data,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: AerosolLaneProps) {
  const totalWidth = getTimelineWidth(data.length, hourWidth);
  const barInset = hourWidth >= 12 ? 2 : 1;

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx, w, h) => {
    const textStyle = getAodTextStyle();

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (!d) continue;
      const x = getHourLeft(i, hourWidth);
      const cx = getHourCenter(i, hourWidth);

      // Background color band
      ctx.fillStyle = aodColor(d.aod);
      ctx.fillRect(x, 0, hourWidth, h);

      // Bar height proportional to AOD
      if (d.aod != null && d.aod > 0) {
        const barH = Math.min(d.aod / MAX_AOD, 1) * (h - 4);
        ctx.fillStyle = aodBarColor(d.aod);
        ctx.fillRect(x + barInset, h - 2 - barH, Math.max(1, hourWidth - barInset * 2), barH);
      }

      // Text label for notable values
      if (d.aod != null && d.aod >= 0.1) {
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.lineWidth = 2;
        ctx.strokeStyle = textStyle.stroke;
        ctx.strokeText(d.aod.toFixed(2), cx, 11);
        ctx.fillStyle = textStyle.fill;
        ctx.fillText(d.aod.toFixed(2), cx, 11);
      }
    }
  }, [data, hourWidth, barInset]);

  return (
    <div className="lane" style={{ height: `${LANE_HEIGHT}px` }}>
      <div className="lane-data">
        <canvas
          ref={canvasRef}
          style={{ width: `${totalWidth}px`, height: `${LANE_HEIGHT}px`, display: 'block' }}
        />
      </div>
    </div>
  );
}
