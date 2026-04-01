import { useCanvas } from '../hooks/useCanvas';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 30;
const MAX_AOD = 1.0; // AOD rarely exceeds 1.0; values above are clamped

function aodColor(aod) {
  if (aod == null) return 'transparent';
  if (aod < 0.1) return 'rgba(144, 238, 144, 0.3)';  // clean
  if (aod < 0.2) return 'rgba(255, 255, 100, 0.35)';  // light haze
  if (aod < 0.4) return 'rgba(255, 200, 50, 0.45)';   // moderate
  if (aod < 0.7) return 'rgba(255, 140, 50, 0.55)';   // thick haze
  return 'rgba(200, 50, 50, 0.6)';                      // heavy pollution
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
        const alpha = Math.min(0.3 + d.aod * 0.7, 0.85);
        ctx.fillStyle = `rgba(160, 100, 50, ${alpha})`;
        ctx.fillRect(x + 2, h - 2 - barH, COL_WIDTH - 4, barH);
      }

      // Text label for notable values
      if (d.aod != null && d.aod >= 0.1) {
        ctx.fillStyle = d.aod >= 0.4 ? '#fff' : '#555';
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
