import { useCallback, useEffect, useRef, useState } from 'react';
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
  const hours = (selection.endIndex - selection.startIndex) * hoursPerColumn;

  const [labelStyle, setLabelStyle] = useState<React.CSSProperties | null>(null);
  const prevLeftRef = useRef(left);
  const prevWidthRef = useRef(width);

  // 在 selection 变化时（不监听滚动事件），计算 label 的 fixed 位置
  // 用 max/min 双侧钳制，只在选区变化时重新计算，滚动时不动
  useEffect(() => {
    // 跳过渲染时第一次触发（还没到初始渲染完成后）
    // 实际上只要 left/width 变了就执行
    const scroller = document.querySelector('.timeline-scroller');
    if (!scroller) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const scrollerScrollLeft = scroller.scrollLeft;

    // 选区的视口 left
    const selLeftViewport = left - scrollerScrollLeft + scrollerRect.left;
    const selRightViewport = selLeftViewport + width;

    // label 在选区中心
    const centre = (selLeftViewport + selRightViewport) / 2;

    // 双侧钳制
    const pad = 4;
    const viewportWidth = window.innerWidth;
    const labelWidth = 34; // min-width: 34px + 2*7px padding = 34
    const rightBoundary = viewportWidth - labelWidth - pad;

    let fixedLeft = centre - labelWidth / 2;
    fixedLeft = Math.max(pad, Math.min(rightBoundary, fixedLeft));

    setLabelStyle({
      position: 'fixed',
      left: `${fixedLeft}px`,
      top: `${scrollerRect.top + 10}px`,
    });

    prevLeftRef.current = left;
    prevWidthRef.current = width;
  }, [left, width]);

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
        />
        <button
          type="button"
          className="timeline-capture-handle is-right"
          onPointerDown={(event) => startDrag('end', event)}
          aria-label="调整截图结束时间"
          title="调整结束时间"
        />
      </div>
      {/* label 用 position: fixed，在 selection 变化时（不监听滚动事件）
          通过 useEffect 重新计算视口位置，用 max/min 双侧钳制。
          渲染时计算一次，滚动时不重新计算，不卡。 */}
      <span
        className={['timeline-capture-label-fixed', labelStyle ? '' : 'is-hidden'].filter(Boolean).join(' ')}
        style={labelStyle ?? undefined}
      >
        {hours}h
      </span>
    </div>
  );
}
