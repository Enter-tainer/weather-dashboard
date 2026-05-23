import './Dashboard.css';

const COL_WIDTH = 22;

export default function DashboardBackground({ data }) {
  if (!data || data.length === 0) return null;

  const totalWidth = data.length * COL_WIDTH;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: totalWidth, zIndex: 0, pointerEvents: 'none' }}>
      {/* Night Bands */}
      {data.nightBands && data.nightBands.map((band, idx) => {
         const leftPx = band.left * COL_WIDTH + COL_WIDTH / 2;
         const rightPx = band.right * COL_WIDTH + COL_WIDTH / 2;
         return (
            <div key={`night-${idx}`} style={{ position: 'absolute', top: 0, left: `${leftPx}px`, width: `${rightPx - leftPx}px`, height: '100%', backgroundColor: 'var(--cell-night)' }} />
         );
      })}
      
      {/* Grid Lines */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' }}>
         {data.map((_, index) => (
            <div key={`grid-${index}`} style={{ width: `${COL_WIDTH}px`, height: '100%', borderRight: '1px solid var(--grid-line)' }} />
         ))}
      </div>
    </div>
  );
}
