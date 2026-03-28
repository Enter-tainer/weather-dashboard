import './Dashboard.css';

export default function AirQualityLane({ data }) {
  const getAqiColor = (aqi) => {
    if (aqi <= 50) return 'var(--aqi-good)';
    if (aqi <= 100) return 'var(--aqi-moderate)';
    if (aqi <= 150) return 'var(--aqi-sg)';
    if (aqi <= 200) return 'var(--aqi-unhealthy)';
    if (aqi <= 300) return 'var(--aqi-vu)';
    return 'var(--aqi-hazardous)';
  };

  const getVisibilityColor = (visKm) => {
    if (visKm == null || visKm === '-') return 'transparent';
    if (visKm >= 10) return 'rgba(0, 228, 0, 0.08)'; // OK
    if (visKm >= 4) return 'rgba(255, 230, 0, 0.15)'; // Moderate haze
    if (visKm >= 1) return 'rgba(255, 160, 50, 0.18)'; // Poor visibility
    return 'rgba(255, 80, 80, 0.22)'; // Severe fog
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 'min-content' }}>
      
      {/* Title / Main AQI Row */}
      <div className="lane" style={{ height: '30px', fontWeight: 'normal' }}>
        <div className="lane-data">
          {data.map((item, index) => {
            const bgColor = getAqiColor(item.aqiUS);
            const color = '#333';
            return (
              <div key={index} className="lane-cell" style={{ backgroundColor: bgColor, fontSize: '11px', color }}>
                {item.aqiUS}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Visibility Row (m to km) */}
      <div className="lane" style={{ height: '20px', fontSize: '9px', borderBottom: 'none' }}>
        <div className="lane-data">
          {data.map((item, index) => {
            const visKm = item.visibility != null ? (item.visibility / 1000).toFixed(1) : '-';
            const bgColor = getVisibilityColor(visKm !== '-' ? parseFloat(visKm) : null);
            
            return (
              <div key={index} className="lane-cell" style={{ backgroundColor: bgColor, color: '#444' }}>
                {visKm !== '-' ? parseFloat(visKm) : ''}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
