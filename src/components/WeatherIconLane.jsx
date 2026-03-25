import './Dashboard.css';
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, HelpCircle } from 'lucide-react';

function getWeatherIcon(code) {
  const props = { size: 18, color: '#444' };
  
  if (code === 0) return <Sun {...props} color="#e69c00" />; // Clear sky
  if (code === 1) return <CloudSun {...props} color="#deba37" />; // Mainly clear
  if (code === 2) return <Cloud {...props} color="#888" />; // Partly cloudy
  if (code === 3) return <Cloud {...props} color="#666" />; // Overcast
  if ([45, 48].includes(code)) return <CloudFog {...props} />; // Fog
  if ([51, 53, 55].includes(code)) return <CloudDrizzle {...props} color="#3b82f6" />; // Drizzle
  if ([56, 57].includes(code)) return <CloudDrizzle {...props} color="#3b82f6" />; // Freezing Drizzle
  if ([61, 63, 65].includes(code)) return <CloudRain {...props} color="#1d4ed8" />; // Rain
  if ([66, 67].includes(code)) return <CloudRain {...props} color="#1d4ed8" />; // Freezing Rain
  if ([71, 73, 75, 77].includes(code)) return <CloudSnow {...props} color="#0284c7" />; // Snow fall
  if ([80, 81, 82].includes(code)) return <CloudRain {...props} color="#1d4ed8" />; // Rain showers
  if ([85, 86].includes(code)) return <CloudSnow {...props} color="#0284c7" />; // Snow showers
  if ([95].includes(code)) return <CloudLightning {...props} color="#9333ea" />; // Thunderstorm
  if ([96, 99].includes(code)) return <CloudLightning {...props} color="#9333ea" />; // Thunderstorm with hail
  
  return <HelpCircle {...props} />;
}

export default function WeatherIconLane({ data }) {
  return (
    <div className="lane weather-icon-lane" style={{ height: 'var(--lane-height-icon)' }}>
      <div className="lane-data">
        {data.map((item, index) => {
          // Only show icon every 3 hours to avoid clutter
          const showIcon = index % 3 === 0;

          return (
            <div key={index} className="lane-cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {showIcon ? getWeatherIcon(item.weatherCode) : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
