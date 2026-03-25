import './Dashboard.css';

export default function CapeLane({ data }) {
  // CAPE J/kg ranges. Usually <1000 is mild, 1000-2000 is moderate, >2000 is severe
  const getCapeColor = (cape) => {
    if (cape < 100) return 'transparent';
    if (cape < 500) return 'rgba(255, 235, 59, 0.3)'; // light yellow
    if (cape < 1000) return 'rgba(255, 152, 0, 0.4)'; // orange
    if (cape < 2000) return 'rgba(244, 67, 54, 0.5)'; // red
    return 'rgba(156, 39, 176, 0.6)'; // purple
  };

  return (
    <div className="lane cape-lane" style={{ height: 'var(--lane-height-cape)', backgroundColor: 'transparent', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const cape = item.cape;
           const bgColor = getCapeColor(cape);
           return (
             <div key={index} className="lane-cell" style={{ backgroundColor: bgColor, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                {index % 3 === 0 && cape > 100 && (
                   <span style={{ fontSize: '9px', color: '#444', fontWeight: 'bold' }}>{Math.round(cape)}</span>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
