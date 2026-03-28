import './Dashboard.css';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudRainWind, CloudSnow, CloudHail, CloudLightning, CloudSunRain, CloudMoonRain, HelpCircle } from 'lucide-react';

function getWeatherIcon(code, isNight, size = 18) {
  const props = { size, color: '#444' };

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

// Compute top N weather codes from ensemble members, sorted by frequency
function getTopWeatherCodes(weatherCodeMembers, maxCount = 3) {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return [];
  const freq = {};
  for (const code of weatherCodeMembers) {
    freq[code] = (freq[code] || 0) + 1;
  }
  const total = weatherCodeMembers.length;
  return Object.entries(freq)
    .map(([code, count]) => ({ code: Number(code), probability: count / total }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, maxCount);
}

export default function WeatherIconLane({ data }) {
  return (
    <div className="lane weather-icon-lane" style={{ height: 'var(--lane-height-icon)' }}>
      <div className="lane-data">
        {data.map((item, index) => {
          const isNight = item.sunAltitude < 0;
          const topCodes = getTopWeatherCodes(item.weatherCodeMembers);
          const hasEnsemble = topCodes.length > 0;

          return (
            <div key={index} className="lane-cell" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '2px',
              paddingBottom: '1px',
            }}>
              {hasEnsemble ? (
                topCodes.map((entry, rank) => (
                  <div key={entry.code} style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: Math.max(0.2, entry.probability),
                    width: '100%',
                  }}>
                    {getWeatherIcon(entry.code, isNight, rank === 0 ? 16 : 13)}
                    <span style={{
                      position: 'absolute',
                      right: 0,
                      bottom: -1,
                      fontSize: '7px',
                      color: '#888',
                      lineHeight: 1,
                    }}>
                      {Math.round(entry.probability * 100)}
                    </span>
                  </div>
                ))
              ) : (
                // Fallback: show deterministic forecast icon (every 3 hours)
                index % 3 === 0 ? getWeatherIcon(item.weatherCode, isNight) : ''
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
