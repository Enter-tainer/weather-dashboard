import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useCanvasCaptureContext, type CanvasCaptureRegistration } from './canvasCaptureContext';

export type CanvasDraw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * Draw directly on a live <canvas> element (no toDataURL encoding).
 * Returns a ref to attach to a <canvas> element.
 *
 * @param {number} width  - CSS pixel width
 * @param {number} height - CSS pixel height
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
 * @param {unknown[]} deps - dependency array (re-draws when changed)
 * @returns {React.RefObject<HTMLCanvasElement>}
 */
export function useCanvas(
  width: number,
  height: number,
  draw: CanvasDraw,
  deps: readonly unknown[] = [],
): React.RefObject<HTMLCanvasElement | null> {
  const captureContext = useCanvasCaptureContext();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  const sizeRef = useRef({ width, height });
  const frameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const captureRegistrationRef = useRef<CanvasCaptureRegistration | null>(null);

  useLayoutEffect(() => {
    drawRef.current = draw;
    sizeRef.current = { width, height };
  });

  useLayoutEffect(() => {
    if (!captureContext) return undefined;

    const registration = captureContext.registerCanvas();
    captureRegistrationRef.current = registration;

    return () => {
      registration.unregister();
      if (captureRegistrationRef.current === registration) {
        captureRegistrationRef.current = null;
      }
    };
  }, [captureContext]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const { width: currentWidth, height: currentHeight } = sizeRef.current;

    if (!canvas || !currentWidth || !currentHeight) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(currentWidth * dpr));
    canvas.height = Math.max(1, Math.round(currentHeight * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRef.current(ctx, currentWidth, currentHeight);
    captureRegistrationRef.current?.markDrawn();
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (document.hidden) return;
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      redraw();
    });
  }, [redraw]);

  const scheduleResumeRedraw = useCallback(() => {
    scheduleRedraw();

    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }

    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      scheduleRedraw();
    }, 250);
  }, [scheduleRedraw]);

  const cancelScheduledRedraw = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps */
  useLayoutEffect(() => {
    redraw();
  }, [redraw, width, height, ...deps]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const canvas = canvasRef.current;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelScheduledRedraw();
        return;
      }

      scheduleResumeRedraw();
    };
    const handleContextLost = (event: Event) => event.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', scheduleResumeRedraw);
    window.addEventListener('focus', scheduleResumeRedraw);
    window.addEventListener('resize', scheduleRedraw);
    window.addEventListener('orientationchange', scheduleResumeRedraw);
    window.addEventListener('weather-theme-change', scheduleResumeRedraw);
    window.addEventListener('weather-render-profile-change', scheduleResumeRedraw);
    window.addEventListener('weather-dashboard-layout-change', scheduleResumeRedraw);
    canvas?.addEventListener('contextlost', handleContextLost);
    canvas?.addEventListener('contextrestored', scheduleResumeRedraw);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', scheduleResumeRedraw);
      window.removeEventListener('focus', scheduleResumeRedraw);
      window.removeEventListener('resize', scheduleRedraw);
      window.removeEventListener('orientationchange', scheduleResumeRedraw);
      window.removeEventListener('weather-theme-change', scheduleResumeRedraw);
      window.removeEventListener('weather-render-profile-change', scheduleResumeRedraw);
      window.removeEventListener('weather-dashboard-layout-change', scheduleResumeRedraw);
      canvas?.removeEventListener('contextlost', handleContextLost);
      canvas?.removeEventListener('contextrestored', scheduleResumeRedraw);

      cancelScheduledRedraw();
    };
  }, [cancelScheduledRedraw, scheduleRedraw, scheduleResumeRedraw]);

  return canvasRef;
}
