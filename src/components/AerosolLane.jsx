import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 30;
const MAX_AOD = 1.5;

// Sky-appearance gradient: continuous interpolation between key color stops
// Reflects actual atmospheric appearance at each AOD level
const BG_STOPS = [
  // [aod, r, g, b, a]
  [0.0,  28, 169, 201, 0.35],  // crystal blue sky
  [0.1, 135, 206, 235, 0.40],  // normal clear day
  [0.25, 185, 215, 232, 0.42], // fading blue
  [0.45, 210, 218, 226, 0.45], // milky white haze
  [0.65, 200, 185, 155, 0.50], // hazy khaki
  [1.0, 166, 123,  91, 0.55],  // dust brown
  [1.5, 139,  69,  19, 0.60],  // apocalyptic
];

const BAR_STOPS = [
  [0.0,   70, 150, 180, 0.45],
  [0.25,  70, 150, 180, 0.50],
  [0.45, 160, 170, 180, 0.55],
  [0.8,  180, 155, 110, 0.65],
  [1.5,  120,  55,  15, 0.85],
];

function lerp(a, b, t) { return a + (b - a) * t; }

function interpolate(stops, aod) {
  if (aod <= stops[0][0]) return stops[0];
  if (aod >= stops[stops.length - 1][0]) return stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (aod <= stops[i + 1][0]) {
      const t = (aod - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return [aod, ...stops[i].slice(1).map((v, j) => lerp(v, stops[i + 1][j + 1], t))];
    }
  }
  return stops[stops.length - 1];
}

function aodColor(aod) {
  if (aod == null) return 'transparent';
  const [, r, g, b, a] = interpolate(BG_STOPS, aod);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

function aodBarColor(aod) {
  const [, r, g, b, a] = interpolate(BAR_STOPS, aod);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

function getAodTextStyle() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return {
    fill: cssVar('--aod-text', isDark ? '#ffffff' : '#111111'),
    stroke: cssVar('--aod-text-stroke', isDark ? '#000000' : 'rgba(255,255,255,0.85)'),
  };
}

export default function AerosolLane({ data }) {
  const totalWidth = data.length * COL_WIDTH;

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx, w, h) => {
    const textStyle = getAodTextStyle();

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const x = i * COL_WIDTH;

      // Background color band
      ctx.fillStyle = aodColor(d.aod);
      ctx.fillRect(x, 0, COL_WIDTH, h);

      // Bar height proportional to AOD
      if (d.aod != null && d.aod > 0) {
        const barH = Math.min(d.aod / MAX_AOD, 1) * (h - 4);
        ctx.fillStyle = aodBarColor(d.aod);
        ctx.fillRect(x + 2, h - 2 - barH, COL_WIDTH - 4, barH);
      }

      // Text label for notable values
      if (d.aod != null && d.aod >= 0.1) {
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.lineWidth = 2;
        ctx.strokeStyle = textStyle.stroke;
        ctx.strokeText(d.aod.toFixed(2), x + COL_WIDTH / 2, 11);
        ctx.fillStyle = textStyle.fill;
        ctx.fillText(d.aod.toFixed(2), x + COL_WIDTH / 2, 11);
      }
    }
  }, [data]);

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
