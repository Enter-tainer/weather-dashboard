import { useState, useEffect, useCallback } from 'react';
import { fetchFullTimeline, fetchTimelineForRoute } from '../services/api';
import { parseSwitchableRoute, buildRouteForSelections } from '../services/urlParser';
import TimeAxis from './TimeAxis';
import WeatherIconLane from './WeatherIconLane';
import TemperatureLane from './TemperatureLane';
import TemperatureTextLane from './TemperatureTextLane';
import CloudEnsembleLane from './CloudEnsembleLane';
import CloudAndRainLane from './CloudAndRainLane';
import PrecipitationProbLane from './PrecipitationProbLane';
import HumidityLane from './HumidityLane';
import UVLane from './UVLane';
import PressureLane from './PressureLane';
import CapeLane from './CapeLane';
import WindLane, { getBeaufort } from './WindLane';
import AirQualityLane from './AirQualityLane';
import DashboardBackground from './DashboardBackground';
import TwilightLane from './TwilightLane';
import LocationLane from './LocationLane';

import './Dashboard.css';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateSlots, setDateSlots] = useState(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const switchable = parseSwitchableRoute();
    let fetchPromise;

    if (switchable) {
      setDateSlots(switchable.dateSlots);
      // Only fetch the active city per date slot
      const route = buildRouteForSelections(switchable.dateSlots);
      fetchPromise = fetchTimelineForRoute(route);
    } else {
      fetchPromise = fetchFullTimeline();
    }

    fetchPromise
      .then(timeline => {
        setData(timeline);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Build a map: displayName -> { date, entries[], activeIndex } for switchable slots
  const switchInfo = {};
  if (dateSlots) {
    for (const slot of dateSlots) {
      if (slot.entries.length > 1) {
        const activeEntry = slot.entries[slot.activeIndex];
        switchInfo[activeEntry.originalName] = slot;
      }
    }
  }

  const handleCityClick = useCallback(async (cityName) => {
    if (switching || !dateSlots) return;
    // Find the slot containing this city
    const slot = dateSlots.find(s => s.entries[s.activeIndex].originalName === cityName);
    if (!slot || slot.entries.length <= 1) return;

    setSwitching(true);
    const newSlots = dateSlots.map(s => {
      if (s === slot) {
        return { ...s, activeIndex: (s.activeIndex + 1) % s.entries.length };
      }
      return s;
    });
    setDateSlots(newSlots);

    try {
      const route = buildRouteForSelections(newSlots);
      const timeline = await fetchTimelineForRoute(route);
      setData(timeline);
    } catch (err) {
      console.error(err);
    }
    setSwitching(false);
  }, [dateSlots, switching]);

  if (loading) return <div className="loading-state">Loading global weather data...</div>;
  if (!data || data.length === 0) {
    return <div>No data available</div>;
  }

  // Calculate Global Scales for Y-Axes
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let minP = Infinity;
  let maxP = -Infinity;
  let maxBft = 0;
  data.forEach(d => {
    if (d.temperature < minTemp) minTemp = d.temperature;
    if (d.temperature > maxTemp) maxTemp = d.temperature;
    d.tempMembers?.forEach(m => {
      if (m < minTemp) minTemp = m;
      if (m > maxTemp) maxTemp = m;
    });

    if (d.pressure < minP) minP = d.pressure;
    if (d.pressure > maxP) maxP = d.pressure;
    d.pressureMembers?.forEach(m => {
      if (m < minP) minP = m;
      if (m > maxP) maxP = m;
    });

    // Wind scale using Beaufort
    const bSpeed = getBeaufort(d.windSpeed);
    const bGusts = getBeaufort(d.windGusts);
    if (bSpeed > maxBft) maxBft = bSpeed;
    if (bGusts > maxBft) maxBft = bGusts;
  });

  if (minTemp !== Infinity) {
    minTemp -= 5; maxTemp += 5;
    if (minTemp === maxTemp) maxTemp += 1;
  }
  if (minP !== Infinity) {
    minP = Math.floor(minP) - 1;
    maxP = Math.ceil(maxP) + 1;
    if (minP === maxP) maxP += 1;
  }
  if (maxBft < 4) maxBft = 4;

  const tempSteps = [];
  if (minTemp !== Infinity) {
    const minTempVal = Math.floor(minTemp / 5) * 5;
    const maxTempVal = Math.ceil(maxTemp / 5) * 5;
    for (let t = minTempVal; t <= maxTempVal; t += 5) tempSteps.push(t);
  }

  return (
    <div className="dashboard-wrapper">      {/* Legend Sidebar */}
      <div className="legend-sidebar">
        <div className="legend-cell" style={{ height: '24px', borderBottom: 'none' }}
>
          <a
            href="https://github.com/Enter-tainer/weather-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', opacity: 0.7, textDecoration: 'none' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
          </a>
        </div>
        <div className="legend-cell" style={{ height: 'var(--lane-height-basic)', flexDirection: 'column', justifyContent: 'center', fontSize: '11px', color: '#555' }}>
          <div>星期</div>
          <div style={{ marginTop: '2px' }}>小时</div>
        </div>
        <div className="legend-cell" style={{ height: '12px', fontSize: '9px', color: '#888' }}>曙暮</div>
        <div className="legend-cell" style={{ height: 'var(--lane-height-icon)', fontSize: '11px', color: '#555' }}>天气</div>

        <div className="legend-cell" style={{ height: 'var(--lane-height-uv)', flexDirection: 'column', justifyContent: 'center', fontSize: '11px', color: '#555' }}>
          <div>紫外线 <span style={{fontSize: '8px', color: '#888'}}>UV</span></div>
        </div>

        <div className="legend-cell" style={{ height: 'var(--lane-height-humidity)', flexDirection: 'column', justifyContent: 'center', fontSize: '11px', color: '#555' }}>
          <div>湿度 <span style={{fontSize: '9px', color: '#888'}}>%</span></div>
          <div style={{fontSize: '10px', color: '#777'}}>露点 <span style={{fontSize: '8px'}}>°C</span></div>
        </div>
        <div className="legend-cell" style={{ height: '35px', flexDirection: 'column', justifyContent: 'center', fontSize: '11px', color: '#555' }}>
          <div>温度 <span style={{fontSize: '9px', color: '#888'}}>°C</span></div>
        </div>

        {/* Temperature Y-Axis Legend */}
        <div className="legend-cell" style={{ height: 'var(--lane-height-temp)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '8px', left: 0, width: '100%', textAlign: 'center', fontSize: '11px', color: '#555' }}>曲线</span>
          {tempSteps.map(t => {
            const y = 110 - ((t - minTemp) / (maxTemp - minTemp)) * 110;
            if (y >= 15 && y <= 95) {
              return <span key={t} style={{ position: 'absolute', right: '4px', top: `${y - 6}px`, fontSize: '9px', color: '#999' }}>{t}°</span>;
            }
            return null;
          })}
        </div>

        {/* Cloud Ensemble Y-Axis Legend */}
        <div className="legend-cell" style={{ height: '50px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <span style={{ position: 'absolute', top: '5px', left: 0, width: '100%', textAlign: 'center', fontSize: '11px', color: '#555' }}>总云<span style={{fontSize: '9px', color: '#888', marginLeft: '2px'}}>%</span></span>
          <span style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '9px', color: '#bbb' }}>100</span>
          <span style={{ position: 'absolute', top: '20px', right: '2px', fontSize: '9px', color: '#bbb' }}>50</span>
          <span style={{ position: 'absolute', top: '38px', right: '2px', fontSize: '9px', color: '#bbb' }}>0</span>
        </div>

        <div className="legend-cell" style={{ height: 'var(--lane-height-clouds)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '2px', left: 0, width: '100%', textAlign: 'center', fontSize: '11px', color: '#555' }}>云<span style={{fontSize: '8px', color: '#888', marginLeft: '2px'}}>m</span></span>
          <span style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '8px', color: '#aaa' }}>10k</span>
          <span style={{ position: 'absolute', top: '26px', right: '2px', fontSize: '8px', color: '#aaa' }}>8k</span>
          <span style={{ position: 'absolute', top: '56px', right: '2px', fontSize: '8px', color: '#aaa' }}>6k</span>
          <span style={{ position: 'absolute', top: '86px', right: '2px', fontSize: '8px', color: '#aaa' }}>4k</span>
          <span style={{ position: 'absolute', top: '116px', right: '2px', fontSize: '8px', color: '#aaa' }}>2k</span>
          <span style={{ position: 'absolute', top: '146px', right: '2px', fontSize: '8px', color: '#aaa' }}>0</span>
          <div style={{ position: 'absolute', bottom: '2px', width: '100%', textAlign: 'center', fontSize: '10px', color: '#0d47a1' }}>降水<span style={{fontSize: '8px', opacity: 0.7, marginLeft: '1px'}}>mm</span></div>
        </div>

        <div className="legend-cell" style={{ height: 'var(--lane-height-precip-prob)', flexDirection: 'column', justifyContent: 'center', fontSize: '10px', color: '#555' }}>
          <div>降水概率<span style={{fontSize: '8px', color: '#888', marginLeft: '2px'}}>%</span></div>
        </div>

        <div className="legend-cell" style={{ height: 'var(--lane-height-cape)', flexDirection: 'column', justifyContent: 'center', fontSize: '11px', color: '#555' }}>
          <div>对流 <span style={{fontSize: '8px', color: '#888'}}>J/kg</span></div>
        </div>

        {/* Wind Y-Axis Legend */}
        <div className="legend-cell" style={{ height: 'var(--lane-height-wind)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '5px', left: 0, width: '100%', textAlign: 'center', fontSize: '11px', color: '#555' }}>风速</span>
          <span style={{ position: 'absolute', bottom: '5px', left: 0, width: '100%', textAlign: 'center', fontSize: '10px', color: '#777' }}>bft</span>

          <span style={{ position: 'absolute', top: '1px', right: '2px', fontSize: '9px', color: '#aaa' }}>{maxBft}</span>
          <span style={{ position: 'absolute', top: '25px', right: '2px', fontSize: '9px', color: '#aaa' }}>{Math.round(maxBft/2)}</span>
          <span style={{ position: 'absolute', top: '45px', right: '2px', fontSize: '9px', color: '#aaa' }}>0</span>
        </div>

        {/* Pressure Legend */}
        <div className="legend-cell" style={{ height: 'var(--lane-height-pressure)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '2px', left: 0, width: '100%', textAlign: 'center', fontSize: '11px', color: '#555' }}>气压<span style={{fontSize: '8px', color: '#888', marginLeft: '2px'}}>hPa</span></span>
          <span style={{ position: 'absolute', top: '16px', right: '4px', fontSize: '9px', color: '#aaa' }}>{maxP}</span>
          <span style={{ position: 'absolute', bottom: '2px', right: '4px', fontSize: '9px', color: '#aaa' }}>{minP}</span>
        </div>

        <div className="legend-cell" style={{ height: '30px', flexDirection: 'column', justifyContent: 'center', fontSize: '11px', color: '#555' }}>
          <div>AQI</div>
        </div>

        <div className="legend-cell" style={{ height: '20px', flexDirection: 'column', justifyContent: 'center', fontSize: '10px', color: '#555', borderBottom: 'none' }}>
          <div>能见度 <span style={{fontSize: '8px', color: '#888'}}>km</span></div>
        </div>
      </div>

      <div className="timeline-scroller">
        <div className="lanes-container" style={{ width: 'fit-content', minWidth: '100%', position: 'relative', opacity: switching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <DashboardBackground data={data} />
          <LocationLane data={data} switchInfo={switchInfo} onCityClick={handleCityClick} />
          <TimeAxis data={data} switchInfo={switchInfo} onCityClick={handleCityClick} />
          <TwilightLane data={data} />
          <WeatherIconLane data={data} />
          <UVLane data={data} />
          <HumidityLane data={data} />
          <TemperatureTextLane data={data} />
          <TemperatureLane data={data} minTemp={minTemp} maxTemp={maxTemp} />
          <CloudEnsembleLane data={data} />
          <CloudAndRainLane data={data} />
          <PrecipitationProbLane data={data} />
          <CapeLane data={data} />
          <WindLane data={data} maxBft={maxBft} />
          <PressureLane data={data} minP={minP} maxP={maxP} />
          <AirQualityLane data={data} />
        </div>
      </div>
    </div>
  );
}
