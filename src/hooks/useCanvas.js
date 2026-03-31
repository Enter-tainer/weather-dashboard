import { useRef, useLayoutEffect } from 'react';

/**
 * Draw directly on a live <canvas> element (no toDataURL encoding).
 * Returns a ref to attach to a <canvas> element.
 *
 * @param {number} width  - CSS pixel width
 * @param {number} height - CSS pixel height
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
 * @param {any[]} deps    - dependency array (re-draws when changed)
 * @returns {React.RefObject<HTMLCanvasElement>}
 */
export function useCanvas(width, height, draw, deps) {
  const canvasRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    draw(ctx, width, height);
  }, deps);

  return canvasRef;
}
