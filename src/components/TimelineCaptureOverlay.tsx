import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  type CaptureDragMode,
  type CaptureSelection,
  updateCaptureSelectionByDrag,
} from '../services/timelineCapture';
import {
  createTimelineLayout,
  DEFAULT_HOUR_WIDTH,
  EXPANDED_MINUTELY_WIDTH,
  MINUTELY_EXPANDED_SPAN,
  type TimelineLayout,
} from '../services/timelineLayout';

interface TimelineCaptureOverlayProps {
  dataLength: number;
  selection: CaptureSelection;
  onSelectionChange: (selection: CaptureSelection) => void;
  hourWidth?: number;
  hoursPerColumn?: number;
  expandedIndex?: number | null;
}

interface CaptureDragState {
  mode: CaptureDragMode;
  startClientX: number;
  initialSelection: CaptureSelection;
}

function getClosestBoundaryIndex(layout: TimelineLayout, x: number): number {
  if (layout.length === 0) return 0;
  if (x <= 0) return 0;
  if (x >= layout.totalWidth) return layout.length;

  const index = layout.getColumnIndexAt(x);
  const left = layout.getColumnLeft(index);
  const right = layout.getColumnLeft(index + 1);
  return x - left <= right - x ? index : index + 1;
}

export default function TimelineCaptureOverlay({
  dataLength,
  selection,
  onSelectionChange,
  hourWidth = DEFAULT_HOUR_WIDTH,
  hoursPerColumn = 1,
  expandedIndex = null,
}: TimelineCaptureOverlayProps) {
  const [dragState, setDragState] = useState<CaptureDragState | null>(null);
  const layout = useMemo(
    () =>
      createTimelineLayout(
        dataLength,
        hourWidth,
        expandedIndex,
        EXPANDED_MINUTELY_WIDTH,
        MINUTELY_EXPANDED_SPAN,
      ),
    [dataLength, expandedIndex, hourWidth],
  );
  const left = layout.getColumnLeft(selection.startIndex);
  const width = layout.getRangeWidth(selection.startIndex, selection.endIndex);
  const totalWidth = layout.totalWidth;

  const startDrag = useCallback(
    (mode: CaptureDragMode, event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragState({
        mode,
        startClientX: event.clientX,
        initialSelection: selection,
      });
    },
    [selection],
  );

  useEffect(() => {
    if (!dragState) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const initialBoundaryIndex =
        dragState.mode === 'end'
          ? dragState.initialSelection.endIndex
          : dragState.initialSelection.startIndex;
      const initialBoundaryX = layout.getColumnLeft(initialBoundaryIndex);
      const targetBoundaryIndex = getClosestBoundaryIndex(
        layout,
        initialBoundaryX + event.clientX - dragState.startClientX,
      );
      const deltaHours = targetBoundaryIndex - initialBoundaryIndex;
      onSelectionChange(
        updateCaptureSelectionByDrag(
          dragState.initialSelection,
          dragState.mode,
          deltaHours,
          dataLength,
        ),
      );
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
  }, [dataLength, dragState, layout, onSelectionChange]);

  return (
    <div
      className="timeline-capture-overlay"
      style={{ width: `${totalWidth}px` }}
      aria-label="截图时间范围"
    >
      <div className="timeline-capture-mask" style={{ left: 0, width: `${left}px` }} />
      <div
        className="timeline-capture-mask"
        style={{ left: `${left + width}px`, width: `${Math.max(0, totalWidth - left - width)}px` }}
      />
      <div
        className={['timeline-capture-selection', dragState ? 'is-dragging' : '']
          .filter(Boolean)
          .join(' ')}
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
