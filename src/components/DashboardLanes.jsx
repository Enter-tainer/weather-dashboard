import { useState } from 'react';
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
import SoundingDrawer from './SoundingDrawer';
import CloudSoundingHitLayer from './CloudSoundingHitLayer';

function getInitialSoundingIndex() {
  const value = Number(new URLSearchParams(window.location.search).get('sounding'));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

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
  const [soundingIndex, setSoundingIndex] = useState(getInitialSoundingIndex);
  const activeSoundingIndex = hasData && soundingIndex != null && soundingIndex < data.length ? soundingIndex : null;

  const setUrlSoundingIndex = (index) => {
    const url = new URL(window.location.href);
    if (index == null) {
      url.searchParams.delete('sounding');
    } else {
      url.searchParams.set('sounding', String(index));
    }
    window.history.replaceState({}, '', url.toString());
  };

  const selectSoundingIndex = (index) => {
    setSoundingIndex(index);
    setUrlSoundingIndex(index);
  };

  const closeSounding = () => {
    setSoundingIndex(null);
    setUrlSoundingIndex(null);
  };

  const stepSounding = (direction) => {
    setSoundingIndex(current => {
      if (current == null || !hasData) return current;
      const next = Math.max(0, Math.min(data.length - 1, current + direction));
      setUrlSoundingIndex(next);
      return next;
    });
  };

  return (
    <>
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
            {!compactMode && (
              <div className="cloud-sounding-region">
                <CloudEnsembleLane data={data} />
                <CloudAndRainLane data={data} />
                <CloudSoundingHitLayer
                  data={data}
                  activeIndex={activeSoundingIndex}
                  onSelect={selectSoundingIndex}
                />
              </div>
            )}
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
      {activeSoundingIndex != null && data[activeSoundingIndex] && (
        <SoundingDrawer
          item={data[activeSoundingIndex]}
          index={activeSoundingIndex}
          total={data.length}
          onClose={closeSounding}
          onStep={stepSounding}
        />
      )}
    </>
  );
}
