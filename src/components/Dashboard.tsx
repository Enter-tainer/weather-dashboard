import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Download, X } from 'lucide-react';
import RouteEditor, { type RouteEditorHandle } from './RouteEditor';
import CompactToggle from './CompactToggle';
import TimeCompactToggle from './TimeCompactToggle';
import ThemeToggle from './ThemeToggle';
import DashboardLegend from './DashboardLegend';
import DashboardLanes from './DashboardLanes';
import MobileToolMenu from './MobileToolMenu';
import { useCompactMode } from '../hooks/useCompactMode';
import { useTimeCompactMode } from '../hooks/useTimeCompactMode';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMinutelyPrecipitation } from '../hooks/useMinutelyPrecipitation';
import { useThemeMode } from '../hooks/useThemeMode';
import { exportDashboardCapture } from '../services/dashboardCaptureExport';
import {
  captureSelectionFromCurrentDay,
  includeRequiredCaptureRange,
  normalizeCaptureSelection,
  type CaptureSelection,
} from '../services/timelineCapture';
import { createTimelineLayout, getTimelineHourWidth } from '../services/timelineLayout';
import {
  getExpandedMinutelyWidth,
  getMinutelySelectionExpandedSpan,
} from '../services/minutelyExpansion';
import { calculateDashboardScales } from '../services/weatherMetrics';
import { aggregateTimelineByHours } from '../services/timeAggregation';
import type { WeatherTimeline } from '../types/weather';

import './Dashboard.css';

interface DashboardProps {
  testData?: WeatherTimeline | undefined;
}

export default function Dashboard({ testData }: DashboardProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const routeEditorRef = useRef<RouteEditorHandle | null>(null);
  const [captureMode, setCaptureMode] = useState(false);
  const [captureSelection, setCaptureSelection] = useState<CaptureSelection | null>(null);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
  const { compactMode, toggleCompactMode } = useCompactMode();
  const { timeStepHours, toggleTimeCompactMode } = useTimeCompactMode();
  const { mode, effectiveTheme, cycleThemeMode } = useThemeMode();
  const { data, loadingDone, switching, switchInfo, handleCityClick } = useDashboardData(testData);
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return data;
    return aggregateTimelineByHours(data, timeStepHours);
  }, [data, timeStepHours]);
  const scales = useMemo(() => calculateDashboardScales(displayData), [displayData]);
  const minutely = useMinutelyPrecipitation(displayData ?? [], timeStepHours === 1 && !compactMode);
  const minutelyExpandedSpan = getMinutelySelectionExpandedSpan(
    minutely.selection,
    displayData?.length ?? 0,
  );
  const hasData = Array.isArray(displayData) && displayData.length > 0;
  const normalizeCaptureForMinutely = useCallback(
    (selection: CaptureSelection): CaptureSelection => {
      const dataLength = displayData?.length ?? 0;
      const normalized = normalizeCaptureSelection(selection, dataLength);
      if (!minutely.selection) return normalized;

      return includeRequiredCaptureRange(
        normalized,
        {
          startIndex: minutely.selection.index,
          endIndex: minutely.selection.index + minutelyExpandedSpan,
        },
        dataLength,
      );
    },
    [displayData?.length, minutely.selection, minutelyExpandedSpan],
  );
  const activeCaptureSelection = useMemo(() => {
    if (!captureMode || !captureSelection || !displayData || displayData.length === 0) {
      return null;
    }
    return normalizeCaptureForMinutely(captureSelection);
  }, [captureMode, captureSelection, displayData, normalizeCaptureForMinutely]);

  const enterCaptureMode = useCallback(() => {
    if (!displayData || displayData.length === 0) return;

    const scroller = scrollerRef.current;
    const timelineLayout = createTimelineLayout(
      displayData.length,
      getTimelineHourWidth(),
      minutely.selection?.index ?? null,
      getExpandedMinutelyWidth(minutelyExpandedSpan),
      minutelyExpandedSpan,
    );
    const anchorIndex = scroller ? timelineLayout.getColumnIndexAt(scroller.scrollLeft) : 0;
    const selection = scroller
      ? captureSelectionFromCurrentDay(
          anchorIndex * getTimelineHourWidth(),
          displayData,
          getTimelineHourWidth(),
        )
      : normalizeCaptureSelection(
          {
            startIndex: 0,
            endIndex: Math.min(Math.ceil(24 / timeStepHours), displayData.length),
          },
          displayData.length,
        );

    setCaptureSelection(normalizeCaptureForMinutely(selection));
    setCaptureMode(true);
    setCaptureStatus('idle');
  }, [
    displayData,
    minutely.selection?.index,
    minutelyExpandedSpan,
    normalizeCaptureForMinutely,
    timeStepHours,
  ]);

  const exitCaptureMode = useCallback(() => {
    setCaptureMode(false);
    setCaptureSelection(null);
    setCaptureStatus('idle');
  }, []);

  useEffect(() => {
    if (!captureMode) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitCaptureMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [captureMode, exitCaptureMode]);

  const updateCaptureSelection = useCallback(
    (selection: CaptureSelection) => {
      if (!displayData) return;
      setCaptureSelection(normalizeCaptureForMinutely(selection));
    },
    [displayData, normalizeCaptureForMinutely],
  );

  const openRouteEditor = useCallback(() => {
    routeEditorRef.current?.open();
  }, []);

  const exportCapture = useCallback(() => {
    if (!displayData || !activeCaptureSelection || captureStatus === 'exporting') return;

    setCaptureStatus('exporting');
    exportDashboardCapture({
      data: displayData,
      selection: activeCaptureSelection,
      compactMode,
      hoursPerColumn: timeStepHours,
      scales,
      switchInfo,
      minutelySelection: minutely.selection,
    })
      .then(() => {
        exitCaptureMode();
      })
      .catch((error: unknown) => {
        console.error('Failed to export weather capture:', error);
        setCaptureStatus('error');
      });
  }, [
    activeCaptureSelection,
    captureStatus,
    compactMode,
    displayData,
    exitCaptureMode,
    scales,
    switchInfo,
    timeStepHours,
    minutely.selection,
  ]);

  return (
    <div className="dashboard-wrapper">
      {!captureMode && (
        <>
          <ThemeToggle mode={mode} effectiveTheme={effectiveTheme} onToggle={cycleThemeMode} />
          <CompactToggle compactMode={compactMode} onToggle={toggleCompactMode} />
          <TimeCompactToggle timeStepHours={timeStepHours} onToggle={toggleTimeCompactMode} />
          <RouteEditor ref={routeEditorRef} />
          <button
            type="button"
            className="capture-mode-btn"
            onClick={enterCaptureMode}
            disabled={!hasData}
            title="截图"
            aria-label="进入截图模式"
          >
            <Camera size={20} />
          </button>
          <MobileToolMenu
            themeMode={mode}
            effectiveTheme={effectiveTheme}
            onThemeToggle={cycleThemeMode}
            compactMode={compactMode}
            onCompactToggle={toggleCompactMode}
            timeStepHours={timeStepHours}
            onTimeCompactToggle={toggleTimeCompactMode}
            onOpenRouteEditor={openRouteEditor}
            onEnterCaptureMode={enterCaptureMode}
            captureDisabled={!hasData}
          />
        </>
      )}
      {captureMode && (
        <div className="capture-toolbar" aria-label="截图工具栏">
          <button
            type="button"
            className="capture-toolbar-btn"
            onClick={exitCaptureMode}
            aria-label="退出截图模式"
            title="取消"
          >
            <X size={16} />
          </button>
          <button
            type="button"
            className="capture-toolbar-btn is-primary"
            onClick={exportCapture}
            disabled={!activeCaptureSelection || captureStatus === 'exporting'}
            aria-label="导出截图 PNG"
            title={captureStatus === 'exporting' ? '导出中' : '导出 PNG'}
          >
            <Download size={16} />
          </button>
          {captureStatus === 'error' && <span className="capture-error">导出失败</span>}
        </div>
      )}
      <DashboardLegend compactMode={compactMode} scales={scales} />
      <DashboardLanes
        data={displayData}
        loadingDone={loadingDone}
        switching={switching}
        switchInfo={switchInfo}
        onCityClick={handleCityClick}
        compactMode={compactMode}
        hoursPerColumn={timeStepHours}
        scales={scales}
        scrollerRef={scrollerRef}
        captureMode={captureMode}
        captureSelection={activeCaptureSelection}
        onCaptureSelectionChange={updateCaptureSelection}
        minutelyAvailableIndices={minutely.availableIndices}
        minutelySelection={minutely.selection}
        onMinutelySelect={minutely.select}
      />
    </div>
  );
}
