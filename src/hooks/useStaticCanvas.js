import { useState, useLayoutEffect } from 'react';

/**
 * Draw on an offscreen canvas, then convert to a static <img> data URL.
 * This frees the GPU texture that a live <canvas> element would hold,
 * significantly reducing compositing cost on mobile devices.
 *
 * @param {number} width  - CSS pixel width
 * @param {number} height - CSS pixel height
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
 * @param {any[]} deps    - dependency array (re-draws when changed)
 * @returns {string|null} data URL for an <img src>
 */
export function useStaticCanvas(width, height, draw, deps) {
  const [src, setSrc] = useState(null);

  // useLayoutEffect so the state update flushes synchronously before paint —
  // the user never sees an empty frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!width || !height) { setSrc(null); return; }

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    draw(ctx, width, height);

    setSrc(canvas.toDataURL());
  }, deps);

  return src;
}
