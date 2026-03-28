import './Dashboard.css';

export default function CapeLane({ data }) {
  // CAPE J/kg ranges. Usually <1000 is mild, 1000-2000 is moderate, >2000 is severe
  const getCapeColor = (cape) => {
    if (cape < 100) return 'transparent';
    if (cape < 500) return 'rgba(255, 235, 59, 0.15)'; // light yellow
    if (cape < 1000) return 'rgba(255, 170, 50, 0.2)'; // soft orange
    if (cape < 2000) return 'rgba(244, 100, 80, 0.22)'; // soft red
    return 'rgba(170, 80, 190, 0.25)'; // soft purple
  };

  return (
    <div className="lane cape-lane" style={{ height: 'var(--lane-height-cape)', backgroundColor: 'transparent', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const cape = item.cape;
           const bgColor = getCapeColor(cape);
           return (
             <div key={index} className="lane-cell" style={{ backgroundColor: bgColor, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
               {cape > 0 && (
                 <span style={{ fontSize: '8px', color: '#444', fontWeight: 'bold' }}>{Math.round(cape)}</span>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
