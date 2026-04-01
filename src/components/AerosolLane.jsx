import { useCanvas } from '../hooks/useCanvas';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 30;
const MAX_AOD = 1.5;

// Sky-appearance palette: colors reflect what the sky actually looks like at each AOD level
function aodColor(aod) {
  if (aod == null) return 'transparent';
  if (aod < 0.1) return 'rgba(28, 169, 201, 0.35)';   // crystal blue sky
  if (aod < 0.25) return 'rgba(135, 206, 235, 0.4)';   // normal clear day
  if (aod < 0.45) return 'rgba(210, 218, 226, 0.45)';  // milky white haze
  if (aod < 0.8) return 'rgba(200, 185, 155, 0.5)';    // hazy khaki
  if (aod < 1.5) return 'rgba(166, 123, 91, 0.55)';    // dust brown
  return 'rgba(139, 69, 19, 0.6)';                       // apocalyptic
}

function aodBarColor(aod) {
  if (aod < 0.25) return 'rgba(70, 150, 180, 0.5)';
  if (aod < 0.45) return 'rgba(160, 170, 180, 0.55)';
  if (aod < 0.8) return 'rgba(180, 155, 110, 0.65)';
  if (aod < 1.5) return 'rgba(150, 100, 60, 0.75)';
  return 'rgba(120, 55, 15, 0.85)';
}

function aodTextColor(aod) {
  if (aod < 0.45) return '#335';
  if (aod < 0.8) return '#443';
  return '#fff';
}

export default function AerosolLane({ data }) {
  const totalWidth = data.length * COL_WIDTH;

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx, w, h) => {
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
        ctx.fillStyle = aodTextColor(d.aod);
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
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
