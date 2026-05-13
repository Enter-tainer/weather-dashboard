import { useCanvas } from '../hooks/useCanvas';
import { getBeaufort } from '../services/weatherMetrics';
import './Dashboard.css';

const COL_WIDTH = 22;
const LANE_HEIGHT = 80;
const COMPACT_LANE_HEIGHT = 36;

export default function WindLane({ data, maxBft, compact = false }) {
  const width = data.length * COL_WIDTH;

  const canvasRef = useCanvas(width, LANE_HEIGHT, (ctx) => {
    data.forEach((d, i) => {
      const x = i * COL_WIDTH;
      // Chart available height: 45px (bottom 30px max reserved for arrow area, 5px top padding)
      const drawHeight = 45;

      // Draw ensemble wind bars (faint)
      if (d.windMembers && d.windMembers.length > 0) {
        ctx.fillStyle = 'rgba(0, 150, 136, 0.04)'; // faint teal
        d.windMembers.forEach(w => {
          const bw = getBeaufort(w);
          const h = (bw / maxBft) * drawHeight;
          if (h > 0) ctx.fillRect(x, LANE_HEIGHT - 30 - h, COL_WIDTH, h);
        });
      }

      // Draw main deterministic wind bar
      const bSpeed = getBeaufort(d.windSpeed);
      const mainH = (bSpeed / maxBft) * drawHeight;
      ctx.fillStyle = 'rgba(0, 137, 123, 0.5)'; // dark teal
      if (mainH > 0) ctx.fillRect(x + COL_WIDTH/2 - 4, LANE_HEIGHT - 30 - mainH, 8, mainH);

      // Draw gust alert dot
      const bGusts = getBeaufort(d.windGusts);
      if (bGusts > bSpeed) {
        const gustH = (bGusts / maxBft) * drawHeight;
        ctx.fillStyle = '#d32f2f'; // Red dot for gust
        ctx.beginPath();
        ctx.arc(x + COL_WIDTH/2, LANE_HEIGHT - 30 - gustH, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [data, maxBft]);

  if (compact) {
    return (
      <div className="lane wind-lane" style={{ height: `${COMPACT_LANE_HEIGHT}px`, position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="lane-data">
          {data.map((item, index) => {
            const bft = getBeaufort(item.windSpeed);
            return (
              <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1px' }}>
                <span style={{ fontSize: '11px', lineHeight: 1, color: bft >= 6 ? '#b71c1c' : '#222', fontWeight: bft >= 4 ? 'bold' : 600 }}>
                  {bft}
                </span>
                <svg width="9" height="9" viewBox="0 0 24 24" style={{ transform: `rotate(${item.windDir + 180}deg)`, color: bft >= 6 ? '#b71c1c' : '#555', opacity: 0.8 }}>
                  <path d="M12 2L12 22M12 2L6 8M12 2L18 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="lane wind-lane" style={{ height: `${LANE_HEIGHT}px`, position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="lane-data">
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, zIndex: 1 }} />

        {/* Overlay text and arrows */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${LANE_HEIGHT}px`, display: 'flex', zIndex: 2 }}>
          {data.map((item, index) => (
             <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '3px', alignItems: 'center' }}>
               {index % 3 === 0 && (
                 <>
                   <span style={{ fontSize: '11px', color: '#222', fontWeight: 'bold' }}>{getBeaufort(item.windSpeed)}</span>
                   <svg width="10" height="10" viewBox="0 0 24 24" style={{ transform: `rotate(${item.windDir + 180}deg)`, opacity: 0.8, marginTop: '1px' }}>
                     <path d="M12 2L12 22M12 2L6 8M12 2L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </>
               )}
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
