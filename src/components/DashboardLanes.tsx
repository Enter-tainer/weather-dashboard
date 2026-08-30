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
import SunDirectionCloudDrawer from './SunDirectionCloudDrawer';
import CloudSoundingHitLayer from './CloudSoundingHitLayer';
import CurrentTimeIndicator from './CurrentTimeIndicator';
import TimelineCaptureOverlay from './TimelineCaptureOverlay';
import { useSoundingSelection } from '../hooks/useSoundingSelection';
import { useSunViewSelection } from '../hooks/useSunViewSelection';
import { useSunCloudSection } from '../hooks/useSunCloudSection';
import { computeSunDirection } from '../services/sunDirection';
import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import TimelineLayoutProvider from './TimelineLayoutProvider';
import {
  createTimelineLayout,
  DEFAULT_HOUR_WIDTH,
  getTimelineHourWidth,
} from '../services/timelineLayout';
import {
  getExpandedMinutelyWidth,
  getMinutelySelectionExpandedSpan,
  MINUTELY_EXPANDED_MAX_SPAN,
  MINUTELY_EXPANDED_MIN_SPAN,
} from '../services/minutelyExpansion';
import type { SwitchInfo } from '../hooks/useDashboardData';
import type { CaptureSelection } from '../services/timelineCapture';
import type { DashboardScales, SunEvent, WeatherTimeline } from '../types/weather';
import { CLOUD_AND_RAIN_LANE_HEIGHT, CLOUD_PLOT_HEIGHT } from '../services/cloudAndRainScale';
import { useMemo } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useIsEink } from '../hooks/useRenderProfile';

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
  scrollerRef?: RefObject<HTMLDivElement | null> | undefined;
  captureMode?: boolean;
  captureSelection?: CaptureSelection | null;
  onCaptureSelectionChange?: (selection: CaptureSelection) => void;
  minutelyAvailableIndices?: Set<number> | undefined;
  minutelySelection?: MinutelyPrecipitationSelection | null | undefined;
  onMinutelySelect?: ((index: number) => void) | undefined;
  onSelectSunEvent?: ((ev: SunEvent) => void) | undefined;
}

interface TimelineLanesProps extends Omit<DashboardLanesProps, 'data'> {
  data: WeatherTimeline;
  onSelectSunEvent?: ((ev: SunEvent) => void) | undefined;
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
  onSelectSunEvent?: ((ev: SunEvent) => void) | undefined;
  minutelyAvailableIndices?: Set<number> | undefined;
  onMinutelySelect?: ((index: number) => void) | undefined;
  minutelySelection?: MinutelyPrecipitationSelection | null | undefined;
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
  onSelectSunEvent,
  minutelyAvailableIndices,
  onMinutelySelect,
  minutelySelection,
}: DashboardLaneStackProps) {
  const isEink = useIsEink();
  const { minTemp, maxTemp, maxBft, minP, maxP } = scales;
  const interactive = renderMode === 'interactive';
  const hourWidth = getTimelineHourWidth();
  const usesEnsembleFallback = data.some((item) => item.dataSource === 'ensemble');
  const expandedIndex = minutelySelection?.index ?? null;
  const expandedSpan = getMinutelySelectionExpandedSpan(minutelySelection, data.length);
  const expandedWidth = getExpandedMinutelyWidth(expandedSpan);
  const layout = useMemo(
    () => createTimelineLayout(data.length, hourWidth, expandedIndex, expandedWidth, expandedSpan),
    [data.length, expandedIndex, expandedSpan, expandedWidth, hourWidth],
  );
  const timelineStyle: TimelineStyle = {
    '--col-width-hour': `${hourWidth}px`,
    width: `${layout.totalWidth}px`,
  };

  return (
    <TimelineLayoutProvider layout={layout}>
      <div
        className={[
          'lanes-container',
          switching ? 'is-switching' : '',
          renderMode === 'capture' ? 'is-capture-render' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={timelineStyle}
      >
        {usesEnsembleFallback && (
          <div className="data-source-notice" role="status">
            Forecast 不可用，正在使用 ensemble 近似；缺失字段显示为 —
          </div>
        )}
        <DashboardBackground data={data} hourWidth={hourWidth} />
        {!isEink && (
          <WeatherAmbientBackground data={data} compact={compactMode} hourWidth={hourWidth} />
        )}
        <LocationLane
          data={data}
          switchInfo={switchInfo}
          onCityClick={onCityClick}
          interactive={interactive}
          hourWidth={hourWidth}
        />
        <TimeAxis
          data={data}
          hourWidth={hourWidth}
          hoursPerColumn={hoursPerColumn}
          {...(interactive && onSelectSunEvent ? { onSelectSunEvent } : {})}
        />
        <TwilightLane data={data} hourWidth={hourWidth} />
        <WeatherIconLane data={data} />
        <UVLane data={data} />
        {!compactMode && (
          <ThermoHygroLane data={data} minTemp={minTemp} maxTemp={maxTemp} hourWidth={hourWidth} />
        )}
        {compactMode && <TemperatureTextLane data={data} />}
        {!compactMode && (
          <div className="cloud-sounding-region">
            <CloudEnsembleLane data={data} hourWidth={hourWidth} />
            <CloudAndRainLane
              data={data}
              hourWidth={hourWidth}
              minutelySelection={minutelySelection}
              minutelyAvailableIndices={minutelyAvailableIndices}
              onMinutelySelect={onMinutelySelect}
            />
            {interactive && onSelectSounding && (
              <CloudSoundingHitLayer
                data={data}
                activeTime={activeSoundingTime}
                onSelect={onSelectSounding}
                hourWidth={hourWidth}
                bottomOffset={CLOUD_AND_RAIN_LANE_HEIGHT - CLOUD_PLOT_HEIGHT}
              />
            )}
          </div>
        )}
        <PrecipitationProbLane
          data={data}
          compact={compactMode}
          minutelySelection={minutelySelection}
        />
        {!compactMode && <CapeLane data={data} />}
        <WindLane data={data} maxBft={maxBft} compact={compactMode} hourWidth={hourWidth} />
        {!compactMode && <PressureLane data={data} minP={minP} maxP={maxP} hourWidth={hourWidth} />}
        <AirQualityLane data={data} />
        <AerosolLane data={data} hourWidth={hourWidth} />
        {interactive && (
          <CurrentTimeIndicator
            data={data}
            hourWidth={hourWidth}
            minutelySelection={minutelySelection}
          />
        )}
        {interactive && !loadingDone && <LoadingMoreIndicator />}
      </div>
    </TimelineLayoutProvider>
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
  scrollerRef,
  captureMode = false,
  minutelyAvailableIndices,
  minutelySelection,
  onMinutelySelect,
  onSelectSunEvent,
}: TimelineLanesProps) {
  const { activeSoundingItem, closeSounding, selectSoundingItem, soundingIndex, stepSounding } =
    useSoundingSelection(data);
  const { activeSunEvent, originItem, selectSunEvent, closeSunView } = useSunViewSelection(data);
  const sunDirection = useMemo(
    () =>
      originItem && activeSunEvent ? computeSunDirection(originItem, activeSunEvent.type) : null,
    [originItem, activeSunEvent],
  );
  const sunSectionState = useSunCloudSection(originItem, sunDirection);
  const selectMinutely = (index: number) => {
    const opening = minutelySelection?.index !== index;
    onMinutelySelect?.(index);
    if (!opening) return;

    const scroller = scrollerRef?.current;
    if (!scroller) return;
    window.requestAnimationFrame(() => {
      const panelLeft = index * getTimelineHourWidth();
      let previewSpan = 0;
      while (minutelyAvailableIndices?.has(index + previewSpan)) previewSpan++;
      const panelWidth = getExpandedMinutelyWidth(
        previewSpan > 0
          ? Math.max(MINUTELY_EXPANDED_MIN_SPAN, previewSpan)
          : MINUTELY_EXPANDED_MAX_SPAN,
      );
      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + scroller.clientWidth;
      const padding = 12;
      if (panelLeft < viewLeft + padding || panelLeft + panelWidth > viewRight - padding) {
        const visibleGutter = Math.max(padding, (scroller.clientWidth - panelWidth) / 2);
        scroller.scrollTo({ left: Math.max(0, panelLeft - visibleGutter), behavior: 'smooth' });
      }
    });
  };

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
        onSelectSunEvent={onSelectSunEvent ?? selectSunEvent}
        minutelyAvailableIndices={minutelyAvailableIndices}
        onMinutelySelect={selectMinutely}
        minutelySelection={minutelySelection}
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
      {!captureMode && activeSunEvent && originItem && sunDirection && (
        <SunDirectionCloudDrawer
          origin={originItem}
          direction={sunDirection}
          sectionState={sunSectionState}
          onClose={closeSunView}
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
  minutelyAvailableIndices,
  minutelySelection,
  onMinutelySelect,
  onSelectSunEvent,
}: DashboardLanesProps) {
  const hasData = data && data.length > 0;
  const hourWidth = getTimelineHourWidth();
  const expandedSpan = getMinutelySelectionExpandedSpan(minutelySelection, data?.length ?? 0);

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
            scrollerRef={scrollerRef}
            captureMode={captureMode}
            minutelyAvailableIndices={minutelyAvailableIndices}
            minutelySelection={minutelySelection}
            onMinutelySelect={onMinutelySelect}
            onSelectSunEvent={onSelectSunEvent}
          />
          {captureMode && captureSelection && onCaptureSelectionChange && (
            <TimelineCaptureOverlay
              dataLength={data.length}
              selection={captureSelection}
              onSelectionChange={onCaptureSelectionChange}
              hourWidth={hourWidth || DEFAULT_HOUR_WIDTH}
              hoursPerColumn={hoursPerColumn}
              expandedIndex={minutelySelection?.index ?? null}
              expandedSpan={expandedSpan}
            />
          )}
        </>
      ) : (
        <EmptyTimelineState loadingDone={loadingDone} />
      )}
    </div>
  );
}
