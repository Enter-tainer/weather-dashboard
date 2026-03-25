import './Dashboard.css';

export default function UVLane({ data }) {
  const getUvColor = (uv) => {
    if (uv <= 2) return '#8bc34a'; // Green (Low)
    if (uv <= 5) return '#ffeb3b'; // Yellow (Mod)
    if (uv <= 7) return '#fb8c00'; // Orange (High)
    if (uv <= 10) return '#e53935'; // Red (Very High)
    return '#8e24aa'; // Purple (Extreme)
  };

  return (
    <div className="lane uv-lane" style={{ height: 'var(--lane-height-uv)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const uv = item.uvIndex;
           const showText = uv > 0;
           return (
             <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                {index % 3 === 0 && showText && (
                   <span style={{ fontSize: '10px', color: uv > 2 && uv <= 5 ? '#333' : '#fff', backgroundColor: getUvColor(uv), padding: '0 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                     {Math.round(uv)}
                   </span>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
