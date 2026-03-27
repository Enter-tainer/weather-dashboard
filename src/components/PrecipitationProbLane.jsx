import './Dashboard.css';

// Gradient from light blue (low prob) to dark blue (high prob)
function probColor(prob) {
  if (prob >= 80) return '#01579b';
  if (prob >= 60) return '#0277bd';
  if (prob >= 40) return '#0288d1';
  if (prob >= 20) return '#039be5';
  return '#4fc3f7';
}

export default function PrecipitationProbLane({ data }) {
  return (
    <div className="lane precip-prob-lane" style={{ height: 'var(--lane-height-precip-prob)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const prob = item.precipitationProb;
           const text = prob >= 5 ? `${prob}` : '';

           return (
             <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: 'center' }}>
                {index % 3 === 0 && text && (
                   <span style={{ fontSize: '10px', color: probColor(prob), fontWeight: 'bold' }}>{text}%</span>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
