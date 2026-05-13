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
import WindLane from './WindLane';
import AirQualityLane from './AirQualityLane';
import AerosolLane from './AerosolLane';
import DashboardBackground from './DashboardBackground';
import WeatherAmbientBackground from './WeatherAmbientBackground';
import TwilightLane from './TwilightLane';
import LocationLane from './LocationLane';

export default function DashboardLanes({
  data,
  loadingDone,
  switching,
  switchInfo,
  onCityClick,
  compactMode,
  scales,
}) {
  const hasData = data && data.length > 0;
  const { minTemp, maxTemp, maxBft, minP, maxP } = scales;

  return (
    <div className="timeline-scroller">
      {hasData ? (
        <div className="lanes-container" style={{ width: 'fit-content', minWidth: '100%', position: 'relative', opacity: switching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <DashboardBackground data={data} />
          <WeatherAmbientBackground data={data} compact={compactMode} />
          <LocationLane data={data} switchInfo={switchInfo} onCityClick={onCityClick} />
          <TimeAxis data={data} />
          <TwilightLane data={data} />
          <WeatherIconLane data={data} />
          <UVLane data={data} />
          <HumidityLane data={data} />
          <TemperatureTextLane data={data} />
          {!compactMode && <TemperatureLane data={data} minTemp={minTemp} maxTemp={maxTemp} />}
          {!compactMode && <CloudEnsembleLane data={data} />}
          {!compactMode && <CloudAndRainLane data={data} />}
          <PrecipitationProbLane data={data} compact={compactMode} />
          {!compactMode && <CapeLane data={data} />}
          <WindLane data={data} maxBft={maxBft} compact={compactMode} />
          {!compactMode && <PressureLane data={data} minP={minP} maxP={maxP} />}
          <AirQualityLane data={data} />
          <AerosolLane data={data} />
          {!loadingDone && (
            <div style={{
              position: 'absolute',
              right: '-40px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
            }}>
              <div className="loading-spinner" />
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: '8px', color: '#888' }}>
          {!loadingDone && <div className="loading-spinner" />}
          {loadingDone && 'No data available'}
        </div>
      )}
    </div>
  );
}
