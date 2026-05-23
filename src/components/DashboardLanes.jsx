import TimeAxis from './TimeAxis';
import WeatherIconLane from './WeatherIconLane';
import ThermoHygroLane from './ThermoHygroLane';
import TemperatureTextLane from './TemperatureTextLane';
import CloudEnsembleLane from './CloudEnsembleLane';
import CloudAndRainLane from './CloudAndRainLane';
import PrecipitationProbLane from './PrecipitationProbLane';
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
import CurrentTimeIndicator from './CurrentTimeIndicator';
import { useSoundingSelection } from '../hooks/useSoundingSelection';

function EmptyTimelineState({ loadingDone }) {
  return (
    <div className="timeline-empty-state">
      {!loadingDone && <div className="loading-spinner" />}
      {loadingDone && 'No data available'}
    </div>
  );
}

function LoadingMoreIndicator() {
  return (
    <div className="timeline-loading-indicator">
      <div className="loading-spinner" />
    </div>
  );
}

function TimelineLanes({
  data,
  loadingDone,
  switching,
  switchInfo,
  onCityClick,
  compactMode,
  scales,
}) {
  const { minTemp, maxTemp, maxBft, minP, maxP } = scales;
  const {
    activeSoundingItem,
    closeSounding,
    selectSoundingItem,
    soundingIndex,
    stepSounding,
  } = useSoundingSelection(data);

  return (
    <>
      <div className={['lanes-container', switching ? 'is-switching' : ''].filter(Boolean).join(' ')}>
        <DashboardBackground data={data} />
        <WeatherAmbientBackground data={data} compact={compactMode} />
        <LocationLane data={data} switchInfo={switchInfo} onCityClick={onCityClick} />
        <TimeAxis data={data} />
        <TwilightLane data={data} />
        <WeatherIconLane data={data} />
        <UVLane data={data} />
        {!compactMode && <ThermoHygroLane data={data} minTemp={minTemp} maxTemp={maxTemp} />}
        {compactMode && <TemperatureTextLane data={data} />}
        {!compactMode && (
          <div className="cloud-sounding-region">
            <CloudEnsembleLane data={data} />
            <CloudAndRainLane data={data} />
            <CloudSoundingHitLayer
              data={data}
              activeTime={activeSoundingItem?.time ?? null}
              onSelect={selectSoundingItem}
            />
          </div>
        )}
        <PrecipitationProbLane data={data} compact={compactMode} />
        {!compactMode && <CapeLane data={data} />}
        <WindLane data={data} maxBft={maxBft} compact={compactMode} />
        {!compactMode && <PressureLane data={data} minP={minP} maxP={maxP} />}
        <AirQualityLane data={data} />
        <AerosolLane data={data} />
        <CurrentTimeIndicator data={data} />
        {!loadingDone && <LoadingMoreIndicator />}
      </div>
      {activeSoundingItem && (
        <SoundingDrawer
          item={activeSoundingItem}
          index={soundingIndex}
          total={data.length}
          onClose={closeSounding}
          onStep={stepSounding}
        />
      )}
    </>
  );
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

  return (
    <div className="timeline-scroller">
      {hasData ? (
        <TimelineLanes
          data={data}
          loadingDone={loadingDone}
          switching={switching}
          switchInfo={switchInfo}
          onCityClick={onCityClick}
          compactMode={compactMode}
          scales={scales}
        />
      ) : (
        <EmptyTimelineState loadingDone={loadingDone} />
      )}
    </div>
  );
}
