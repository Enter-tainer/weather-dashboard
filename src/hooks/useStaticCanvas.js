import { useState, useLayoutEffect } from 'react';

/**
 * Draw on an offscreen canvas, then convert to a static <img> data URL.
 * Uses useLayoutEffect + toDataURL so the image is ready before paint
 * (no empty-frame flash). The main GPU savings come from eliminating
 * live canvas textures and CSS gradients, not from this being async.
 *
 * @param {number} width  - CSS pixel width
 * @param {number} height - CSS pixel height
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
 * @param {any[]} deps    - dependency array (re-draws when changed)
 * @returns {string|null} data URL for an <img src>
 */
let canvasSeq = 0;

export function useStaticCanvas(width, height, draw, deps) {
  const [src, setSrc] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!width || !height) { setSrc(null); return; }

    const id = ++canvasSeq;
    const t0 = performance.now();

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    draw(ctx, width, height);
    const t1 = performance.now();

    setSrc(canvas.toDataURL());
    const t2 = performance.now();

    console.log(`[canvas#${id}] ${width}x${height} @${dpr}x — draw:${(t1-t0).toFixed(1)}ms encode:${(t2-t1).toFixed(1)}ms total:${(t2-t0).toFixed(1)}ms`);
  }, deps);

  return src;
}
