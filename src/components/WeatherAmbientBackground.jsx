import { useMemo } from 'react';

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
// Horizontal radius: extend into neighbors for smooth blending
const H_RADIUS_PX = COL_WIDTH * 1.2;

// Height constants (must match CSS vars)
// 28 + 25 + 35 + 35 + 110 = 233
const BG_HEIGHT = 233;

export default function WeatherAmbientBackground({ data }) {
  const background = useMemo(() => {
    const gradients = [];

    for (let i = 0; i < data.length; i++) {
      const dist = computeDistribution(data[i].weatherCodeMembers);
      if (!dist) continue;

      const cx = (i + 0.5) * COL_WIDTH;

      // Stack categories vertically: each gets a position based on cumulative probability
      let cumulative = 0;
      for (const seg of dist) {
        const yCenter = (cumulative + seg.prob / 2) * BG_HEIGHT;
        const vRadius = seg.prob * BG_HEIGHT * 0.7; // slightly smaller than proportional for softer edges
        const [r, g, b] = WEATHER_COLORS[seg.cat];

        gradients.push(
          `radial-gradient(${H_RADIUS_PX}px ${Math.max(vRadius, 8)}px at ${cx}px ${yCenter}px, rgba(${r},${g},${b},${ALPHA}) 0%, rgba(${r},${g},${b},0) 100%)`
        );

        cumulative += seg.prob;
      }
    }

    if (gradients.length === 0) return 'transparent';
    return gradients.join(', ');
  }, [data]);

  const totalWidth = data.length * COL_WIDTH;

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(24px + var(--lane-height-basic) + 12px)',
      left: 0,
      width: totalWidth,
      height: 'calc(28px + var(--lane-height-uv) + var(--lane-height-humidity) + 35px + var(--lane-height-temp))',
      zIndex: 0,
      pointerEvents: 'none',
      background,
    }} />
  );
}
