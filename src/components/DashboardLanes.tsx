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
import TimelineCaptureOverlay from './TimelineCaptureOverlay';
import { useSoundingSelection } from '../hooks/useSoundingSelection';
import {
  DEFAULT_HOUR_WIDTH,
  getTimelineHourWidth,
} from '../services/timelineLayout';
import type { SwitchInfo } from '../hooks/useDashboardData';
import type { CaptureSelection } from '../services/timelineCapture';
import type { DashboardScales, WeatherTimeline } from '../types/weather';
import type { CSSProperties, RefObject } from 'react';

interface EmptyTimelineStateProps {
  loadingDone: boolean;
}

interface DashboardLanesProps {
  data: WeatherTimeline | null;
  loadingDone: boolean;
  switching: boolean;
  switchInfo: SwitchInfo;
  onCityClick: (cityName: string) => void;
  compactMode: boolean;
  hoursPerColumn?: number;
  scales: DashboardScales;
  scrollerRef?: RefObject<HTMLDivElement | null>;
  captureMode?: boolean;
  captureSelection?: CaptureSelection | null;
  onCaptureSelectionChange?: (selection: CaptureSelection) => void;
}

interface TimelineLanesProps extends Omit<DashboardLanesProps, 'data'> {
  data: WeatherTimeline;
}

export type DashboardLaneRenderMode = 'interactive' | 'capture';

export interface DashboardLaneStackProps {
  data: WeatherTimeline;
  compactMode: boolean;
  hoursPerColumn?: number;
  scales: DashboardScales;
  switchInfo: SwitchInfo;
  onCityClick?: (cityName: string) => void;
  loadingDone?: boolean;
  switching?: boolean;
  renderMode?: DashboardLaneRenderMode;
  activeSoundingTime?: string | null;
  onSelectSounding?: (item: WeatherTimeline[number]) => void;
}

type TimelineStyle = CSSProperties & {
  '--col-width-hour'?: string;
};

function EmptyTimelineState({ loadingDone }: EmptyTimelineStateProps) {
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

function noopCityClick() {
  // Screenshot renders are intentionally non-interactive.
}

export function DashboardLaneStack({
  data,
  compactMode,
  hoursPerColumn = 1,
  scales,
  switchInfo,
  onCityClick = noopCityClick,
  loadingDone = true,
  switching = false,
  renderMode = 'interactive',
  activeSoundingTime = null,
  onSelectSounding,
}: DashboardLaneStackProps) {
  const { minTemp, maxTemp, maxBft, minP, maxP } = scales;
  const interactive = renderMode === 'interactive';
  const hourWidth = getTimelineHourWidth();
  const timelineStyle: TimelineStyle = {
    '--col-width-hour': `${hourWidth}px`,
  };

  return (
    <div
      className={[
        'lanes-container',
        switching ? 'is-switching' : '',
        renderMode === 'capture' ? 'is-capture-render' : '',
      ].filter(Boolean).join(' ')}
      style={timelineStyle}
    >
      <DashboardBackground data={data} hourWidth={hourWidth} />
      <WeatherAmbientBackground data={data} compact={compactMode} hourWidth={hourWidth} />
      <LocationLane
        data={data}
        switchInfo={switchInfo}
        onCityClick={onCityClick}
        interactive={interactive}
        hourWidth={hourWidth}
      />
      <TimeAxis data={data} hourWidth={hourWidth} hoursPerColumn={hoursPerColumn} />
      <TwilightLane data={data} hourWidth={hourWidth} />
      <WeatherIconLane data={data} />
      <UVLane data={data} />
      {!compactMode && <ThermoHygroLane data={data} minTemp={minTemp} maxTemp={maxTemp} hourWidth={hourWidth} />}
      {compactMode && <TemperatureTextLane data={data} />}
      {!compactMode && (
        <div className="cloud-sounding-region">
          <CloudEnsembleLane data={data} hourWidth={hourWidth} />
          <CloudAndRainLane data={data} hourWidth={hourWidth} />
          {interactive && onSelectSounding && (
            <CloudSoundingHitLayer
              data={data}
              activeTime={activeSoundingTime}
              onSelect={onSelectSounding}
              hourWidth={hourWidth}
            />
          )}
        </div>
      )}
      <PrecipitationProbLane data={data} compact={compactMode} />
      {!compactMode && <CapeLane data={data} />}
      <WindLane data={data} maxBft={maxBft} compact={compactMode} hourWidth={hourWidth} />
      {!compactMode && <PressureLane data={data} minP={minP} maxP={maxP} hourWidth={hourWidth} />}
      <AirQualityLane data={data} />
      <AerosolLane data={data} hourWidth={hourWidth} />
      {interactive && <CurrentTimeIndicator data={data} hourWidth={hourWidth} />}
      {interactive && !loadingDone && <LoadingMoreIndicator />}
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
  hoursPerColumn = 1,
  scales,
  captureMode = false,
}: TimelineLanesProps) {
  const {
    activeSoundingItem,
    closeSounding,
    selectSoundingItem,
    soundingIndex,
    stepSounding,
  } = useSoundingSelection(data);

  return (
    <>
      <DashboardLaneStack
        data={data}
        loadingDone={loadingDone}
        switching={switching}
        switchInfo={switchInfo}
        onCityClick={onCityClick}
        compactMode={compactMode}
        hoursPerColumn={hoursPerColumn}
        scales={scales}
        renderMode="interactive"
        activeSoundingTime={activeSoundingItem?.time ?? null}
        onSelectSounding={selectSoundingItem}
      />
      {!captureMode && activeSoundingItem && (
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
  hoursPerColumn = 1,
  scales,
  scrollerRef,
  captureMode = false,
  captureSelection = null,
  onCaptureSelectionChange,
}: DashboardLanesProps) {
  const hasData = data && data.length > 0;
  const hourWidth = getTimelineHourWidth();

  return (
    <div className="timeline-scroller" ref={scrollerRef}>
      {hasData ? (
        <>
          <TimelineLanes
            data={data}
            loadingDone={loadingDone}
            switching={switching}
            switchInfo={switchInfo}
            onCityClick={onCityClick}
            compactMode={compactMode}
            hoursPerColumn={hoursPerColumn}
            scales={scales}
            captureMode={captureMode}
          />
          {captureMode && captureSelection && onCaptureSelectionChange && (
            <TimelineCaptureOverlay
              dataLength={data.length}
              selection={captureSelection}
              onSelectionChange={onCaptureSelectionChange}
              hourWidth={hourWidth || DEFAULT_HOUR_WIDTH}
              hoursPerColumn={hoursPerColumn}
            />
          )}
        </>
      ) : (
        <EmptyTimelineState loadingDone={loadingDone} />
      )}
    </div>
  );
}
