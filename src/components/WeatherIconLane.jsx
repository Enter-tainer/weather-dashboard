import './Dashboard.css';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudRainWind, CloudSnow, CloudHail, CloudLightning, CloudSunRain, CloudMoonRain, HelpCircle } from 'lucide-react';

function getWeatherIcon(code, isNight) {
  const props = { size: 18, color: '#444' };

  if (code === 0) return isNight ? <Moon {...props} color="#64748b" /> : <Sun {...props} color="#e69c00" />;
  if (code === 1) return isNight ? <CloudMoon {...props} color="#64748b" /> : <CloudSun {...props} color="#deba37" />;
  if (code === 2) return <Cloud {...props} color={isNight ? "#64748b" : "#888"} />;
  if (code === 3) return <Cloud {...props} color={isNight ? "#475569" : "#666"} />;
  if ([45, 48].includes(code)) return <CloudFog {...props} />;

  // Drizzle: light → moderate → dense
  if (code === 51) return <CloudDrizzle {...props} color="#93c5fd" />;
  if (code === 53) return <CloudDrizzle {...props} color="#60a5fa" />;
  if (code === 55) return <CloudDrizzle {...props} color="#3b82f6" />;
  // Freezing drizzle
  if (code === 56) return <CloudDrizzle {...props} color="#a78bfa" />;
  if (code === 57) return <CloudDrizzle {...props} color="#8b5cf6" />;

  // Rain: light → moderate → heavy
  if (code === 61) return isNight ? <CloudMoonRain {...props} color="#60a5fa" /> : <CloudSunRain {...props} color="#60a5fa" />;
  if (code === 63) return <CloudRain {...props} color="#2563eb" />;
  if (code === 65) return <CloudRainWind {...props} color="#1d4ed8" />;
  // Freezing rain
  if (code === 66) return <CloudRain {...props} color="#a78bfa" />;
  if (code === 67) return <CloudRainWind {...props} color="#8b5cf6" />;

  // Snow: light → moderate → heavy
  if (code === 71) return <CloudSnow {...props} color="#7dd3fc" />;
  if (code === 73) return <CloudSnow {...props} color="#38bdf8" />;
  if (code === 75) return <CloudSnow {...props} color="#0284c7" />;
  if (code === 77) return <CloudSnow {...props} color="#0369a1" />; // Snow grains

  // Rain showers: slight → moderate → violent
  if (code === 80) return isNight ? <CloudMoonRain {...props} color="#60a5fa" /> : <CloudSunRain {...props} color="#60a5fa" />;
  if (code === 81) return <CloudRain {...props} color="#2563eb" />;
  if (code === 82) return <CloudRainWind {...props} color="#1e40af" />;
  // Snow showers
  if (code === 85) return <CloudSnow {...props} color="#38bdf8" />;
  if (code === 86) return <CloudSnow {...props} color="#0284c7" />;

  // Thunderstorm
  if (code === 95) return <CloudLightning {...props} color="#9333ea" />;
  // Thunderstorm with hail
  if (code === 96) return <CloudHail {...props} color="#7c3aed" />;
  if (code === 99) return <CloudHail {...props} color="#6d28d9" />;

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
               {showIcon ? getWeatherIcon(item.weatherCode, item.sunAltitude < 0) : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
