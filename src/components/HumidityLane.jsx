import './Dashboard.css';

export default function HumidityLane({ data }) {
  return (
    <div className="lane humidity-lane" style={{ height: 'var(--lane-height-humidity)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => (
          <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center' }}>
             {index % 3 === 0 && item.humidity != null && (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <span style={{ fontWeight: 'bold', color: '#1565c0', fontSize: '10px' }}>{Math.round(item.humidity)}%</span>
                 <span style={{ color: '#666', fontSize: '9px', marginTop: '-1px' }}>{Math.round(item.dewPoint)}°</span>
               </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
