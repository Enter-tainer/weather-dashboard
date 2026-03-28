import { useMemo } from 'react';
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

// Group consecutive hours with the same weather code into merged runs
function computeMergedRuns(data) {
  const runs = [];
  let i = 0;
  while (i < data.length) {
    const code = data[i].weatherCode;
    const start = i;
    while (i < data.length && data[i].weatherCode === code) i++;
    runs.push({ code, start, length: i - start });
  }
  return runs;
}

// For expanded mode: merge by top-1 ensemble weather code
function computeEnsembleMergedRuns(data) {
  const runs = [];
  let i = 0;
  while (i < data.length) {
    const topCodes = getTopWeatherCodes(data[i].weatherCodeMembers);
    const code = topCodes.length > 0 ? topCodes[0].code : data[i].weatherCode;
    const start = i;
    while (i < data.length) {
      const nextTop = getTopWeatherCodes(data[i].weatherCodeMembers);
      const nextCode = nextTop.length > 0 ? nextTop[0].code : data[i].weatherCode;
      if (nextCode !== code) break;
      i++;
    }
    runs.push({ code, start, length: i - start });
  }
  return runs;
}

export default function WeatherIconLane({ data, expanded }) {
  const laneHeight = expanded ? 'var(--lane-height-icon)' : '28px';

  const runs = useMemo(() => computeMergedRuns(data), [data]);
  const ensembleRuns = useMemo(() => computeEnsembleMergedRuns(data), [data]);

  // Build a lookup: for each cell index, which run does it belong to and is it the middle?
  const cellInfo = useMemo(() => {
    const activeRuns = expanded ? ensembleRuns : runs;
    const info = new Array(data.length);
    let colorIdx = 0;
    for (const run of activeRuns) {
      const mid = run.start + Math.floor(run.length / 2);
      for (let j = run.start; j < run.start + run.length; j++) {
        info[j] = {
          isMiddle: j === mid,
          run,
          colorIdx,
        };
      }
      colorIdx++;
    }
    return info;
  }, [data, expanded, runs, ensembleRuns]);

  return (
    <div className="lane weather-icon-lane" style={{ height: laneHeight, transition: 'height 0.2s ease' }}>
      <div className="lane-data">
        {data.map((item, index) => {
          const isNight = item.sunAltitude < 0;
          const ci = cellInfo[index];
          const isMiddle = ci?.isMiddle;
          const bgColor = ci?.colorIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.04)';

          // Expanded mode: show ensemble top 3 at the middle cell of each run
          if (expanded) {
            const topCodes = isMiddle ? getTopWeatherCodes(item.weatherCodeMembers) : [];
            return (
              <div key={index} className="lane-cell" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '2px',
                paddingBottom: '1px',
                backgroundColor: bgColor,
                borderLeft: index === ci?.run.start ? '1px solid rgba(0,0,0,0.08)' : 'none',
              }}>
                {isMiddle && topCodes.length > 0 ? (
                  topCodes.map((entry, rank) => (
                    <div key={entry.code} style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.4 + 0.6 * entry.probability,
                      width: '100%',
                    }}>
                      {getWeatherIcon(entry.code, isNight, rank === 0 ? 16 : 13)}
                      <span style={{
                        position: 'absolute',
                        right: -8,
                        bottom: -1,
                        fontSize: '7px',
                        color: '#888',
                        lineHeight: 1,
                      }}>
                        {Math.round(entry.probability * 100)}%
                      </span>
                    </div>
                  ))
                ) : ''}
              </div>
            );
          }

          // Collapsed mode: show single icon at the middle of each merged run
          return (
            <div key={index} className="lane-cell" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bgColor,
              borderLeft: index === ci?.run.start ? '1px solid rgba(0,0,0,0.08)' : 'none',
            }}>
              {isMiddle ? getWeatherIcon(item.weatherCode, isNight) : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
