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
import { useThemeMode } from '../hooks/useThemeMode';
import { exportDashboardCapture } from '../services/dashboardCaptureExport';
import {
  captureSelectionFromCurrentDay,
  normalizeCaptureSelection,
  type CaptureSelection,
} from '../services/timelineCapture';
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
  const hasData = Array.isArray(displayData) && displayData.length > 0;
  const activeCaptureSelection = useMemo(() => {
    if (!captureMode || !captureSelection || !displayData || displayData.length === 0) {
      return null;
    }
    return normalizeCaptureSelection(captureSelection, displayData.length);
  }, [captureMode, captureSelection, displayData]);

  const enterCaptureMode = useCallback(() => {
    if (!displayData || displayData.length === 0) return;

    const scroller = scrollerRef.current;
    const selection = scroller
      ? captureSelectionFromCurrentDay(scroller.scrollLeft, displayData)
      : normalizeCaptureSelection(
          {
            startIndex: 0,
            endIndex: Math.min(Math.ceil(24 / timeStepHours), displayData.length),
          },
          displayData.length,
        );

    setCaptureSelection(selection);
    setCaptureMode(true);
    setCaptureStatus('idle');
  }, [displayData, timeStepHours]);

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
      setCaptureSelection(normalizeCaptureSelection(selection, displayData.length));
    },
    [displayData],
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
      />
    </div>
  );
}
