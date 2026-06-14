import { useCallback, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  type CaptureDragMode,
  type CaptureSelection,
  updateCaptureSelectionByDrag,
} from '../services/timelineCapture';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';

interface TimelineCaptureOverlayProps {
  dataLength: number;
  selection: CaptureSelection;
  onSelectionChange: (selection: CaptureSelection) => void;
  hourWidth?: number;
  hoursPerColumn?: number;
}

interface CaptureDragState {
  mode: CaptureDragMode;
  startClientX: number;
  initialSelection: CaptureSelection;
}

export default function TimelineCaptureOverlay({
  dataLength,
  selection,
  onSelectionChange,
  hourWidth = DEFAULT_HOUR_WIDTH,
  hoursPerColumn = 1,
}: TimelineCaptureOverlayProps) {
  const [dragState, setDragState] = useState<CaptureDragState | null>(null);
  const left = selection.startIndex * hourWidth;
  const width = (selection.endIndex - selection.startIndex) * hourWidth;
  const totalWidth = dataLength * hourWidth;

  const startDrag = useCallback((mode: CaptureDragMode, event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragState({
      mode,
      startClientX: event.clientX,
      initialSelection: selection,
    });
  }, [selection]);

  useEffect(() => {
    if (!dragState) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const deltaHours = Math.round((event.clientX - dragState.startClientX) / hourWidth);
      onSelectionChange(updateCaptureSelectionByDrag(
        dragState.initialSelection,
        dragState.mode,
        deltaHours,
        dataLength,
      ));
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dataLength, dragState, hourWidth, onSelectionChange]);

  return (
    <div
      className="timeline-capture-overlay"
      style={{ width: `${totalWidth}px` }}
      aria-label="截图时间范围"
    >
      <div className="timeline-capture-mask" style={{ left: 0, width: `${left}px` }} />
      <div className="timeline-capture-mask" style={{ left: `${left + width}px`, width: `${Math.max(0, totalWidth - left - width)}px` }} />
      <div
        className={[
          'timeline-capture-selection',
          dragState ? 'is-dragging' : '',
        ].filter(Boolean).join(' ')}
        style={{ left: `${left}px`, width: `${width}px` }}
      >
        <button
          type="button"
          className="timeline-capture-handle is-left"
          onPointerDown={(event) => startDrag('start', event)}
          aria-label="调整截图开始时间"
          title="调整开始时间"
        />
        <button
          type="button"
          className="timeline-capture-move"
          onPointerDown={(event) => startDrag('move', event)}
          aria-label="移动截图时间范围"
          title="移动截图范围"
        >
          <span>{(selection.endIndex - selection.startIndex) * hoursPerColumn}h</span>
        </button>
        <button
          type="button"
          className="timeline-capture-handle is-right"
          onPointerDown={(event) => startDrag('end', event)}
          aria-label="调整截图结束时间"
          title="调整结束时间"
        />
      </div>
    </div>
  );
}
