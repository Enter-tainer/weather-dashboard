import './Dashboard.css';

const COL_WIDTH = 22;

// Map sun altitude (degrees) to a sky color
function altitudeToColor(alt) {
  if (alt >= 6) return '#ffffff';                    // day
  if (alt >= 0) return lerpColor('#ffb74d', '#ffffff', alt / 6);   // golden hour (0°→6°)
  if (alt >= -6) return lerpColor('#5c6bc0', '#ffb74d', (alt + 6) / 6);  // blue hour (-6°→0°)
  if (alt >= -12) return lerpColor('#1a237e', '#5c6bc0', (alt + 12) / 6); // nautical (-12°→-6°)
  if (alt >= -18) return lerpColor('#0d0d1a', '#1a237e', (alt + 18) / 6); // astronomical (-18°→-12°)
  return '#0d0d1a';                                  // night
}

function lerpColor(a, b, t) {
  const parse = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

export default function TwilightLane({ data }) {
  if (!data || data.length === 0) return null;

  // Build CSS gradient from sun altitude per hour
  const stops = data.map((item, i) => {
    const color = altitudeToColor(item.sunAltitude ?? 10);
    const pct = ((i + 0.5) / data.length) * 100;
    return `${color} ${pct.toFixed(2)}%`;
  });

  const gradient = `linear-gradient(to right, ${stops.join(', ')})`;

  const totalWidth = data.length * COL_WIDTH;

  return (
    <div className="lane" style={{ height: '12px', minHeight: '12px' }}>
      <div className="lane-data" style={{
        width: `${totalWidth}px`,
        minWidth: `${totalWidth}px`,
        background: gradient,
        borderTop: '1px solid rgba(0,0,0,0.08)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }} />
    </div>
  );
}
