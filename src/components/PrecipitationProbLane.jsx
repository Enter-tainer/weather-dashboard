import './Dashboard.css';

export default function PrecipitationProbLane({ data }) {
  return (
    <div className="lane precip-prob-lane" style={{ height: 'var(--lane-height-precip-prob)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const prob = item.precipitationProb;
           // Only show string if probability >= 5%
           const text = prob >= 5 ? `${prob}` : '';
           const color = prob >= 50 ? '#0288d1' : '#64b5f6'; 

           return (
             <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center' }}>
                {index % 3 === 0 && text && (
                   <span style={{ fontSize: '10px', color: color, fontWeight: 'bold' }}>{text}%</span>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
