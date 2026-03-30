import { useStaticCanvas } from '../hooks/useStaticCanvas';

const COL_WIDTH = 22;

// Soft ambient colors for weather categories
const WEATHER_COLORS = {
  clear:   [255, 213, 79],
  cloudy:  [190, 194, 200],
  fog:     [182, 198, 192],
  drizzle: [147, 197, 253],
  rain:    [96, 165, 250],
  snow:    [186, 230, 253],
  thunder: [192, 132, 252],
};

const CATEGORY_ORDER = ['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder'];

function getWeatherCategory(code) {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'thunder';
}

function computeDistribution(weatherCodeMembers) {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return null;

  const catFreq = {};
  for (const code of weatherCodeMembers) {
    const cat = getWeatherCategory(code);
    catFreq[cat] = (catFreq[cat] || 0) + 1;
  }
  const total = weatherCodeMembers.length;

  return CATEGORY_ORDER
    .filter(cat => catFreq[cat])
    .map(cat => ({ cat, prob: catFreq[cat] / total }));
}

const ALPHA = 0.22;
const H_RADIUS_PX = COL_WIDTH * 1.2;
const BG_HEIGHT = 233;

export default function WeatherAmbientBackground({ data }) {
  const totalWidth = data.length * COL_WIDTH;

  const imgSrc = useStaticCanvas(totalWidth, BG_HEIGHT, (ctx) => {
    for (let i = 0; i < data.length; i++) {
      const dist = computeDistribution(data[i].weatherCodeMembers);
      if (!dist) continue;

      const cx = (i + 0.5) * COL_WIDTH;

      let cumulative = 0;
      for (const seg of dist) {
        const yCenter = (cumulative + seg.prob / 2) * BG_HEIGHT;
        const vRadius = Math.max(seg.prob * BG_HEIGHT * 0.7, 8);
        const [r, g, b] = WEATHER_COLORS[seg.cat];

        // Draw elliptical gradient matching CSS radial-gradient(Hpx Vpx at cx cy)
        // Scale context so a circular gradient becomes elliptical
        ctx.save();
        ctx.translate(cx, yCenter);
        ctx.scale(H_RADIUS_PX / vRadius, 1);

        // Create gradient in scaled space (circular, radius = vRadius)
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, vRadius);
        grad.addColorStop(0, `rgba(${r},${g},${b},${ALPHA})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(0, 0, vRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        cumulative += seg.prob;
      }
    }
  }, [data]);

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(24px + var(--lane-height-basic) + 12px)',
      left: 0,
      width: totalWidth,
      height: 'calc(28px + var(--lane-height-uv) + var(--lane-height-humidity) + 35px + var(--lane-height-temp))',
      zIndex: 0,
      pointerEvents: 'none',
    }}>
      {imgSrc && <img src={imgSrc} style={{ width: '100%', height: '100%' }} alt="" />}
    </div>
  );
}
