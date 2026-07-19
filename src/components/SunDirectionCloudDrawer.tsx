import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import {
  SUN_CLOUD_PLOT_HEIGHT,
  SUN_SECTION_DISTANCES_KM,
  type CloudSection,
  type CloudSectionColumn,
} from '../services/sunCloudSection';
import { APPROX_PRESSURE_HEIGHTS } from '../services/sounding';
import { bearingLabel } from '../services/geo';
import {
  clampToEventWindow,
  findTimeForAltitude,
  type SunDirectionInfo,
} from '../services/sunDirection';
import {
  bulgeKm,
  MAX_SUN_ALT_DEG,
  MIN_SUN_ALT_DEG,
  parallelRays,
} from '../services/sunRayGeometry';
import type { SunEventType, WeatherPoint } from '../types/weather';
import type { SunCloudSectionState } from '../hooks/useSunCloudSection';
import './Dashboard.css';

const CANVAS_WIDTH = 540;
const GRID_ALTS = [1000, 2000, 4000, 5000, 6000, 8000, 10000];
const BOUNDARY_ALTS = new Set([2000, 6000]);
const SUN_DISC_RADIUS_PX = 7;
const SUN_RAY_INNER_RADIUS_PX = 8;
const SUN_RAY_OUTER_RADIUS_PX = 11;

interface SunDirectionCloudDrawerProps {
  origin: WeatherPoint;
  direction: SunDirectionInfo;
  sectionState: SunCloudSectionState;
  onClose: () => void;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function eventLabel(eventType: SunEventType): string {
  return eventType === 'sunrise' ? '日出方向' : '日落方向';
}

// Mirror of CloudAndRainLane's getCloudAltitude — geopotential height, else the standard
// pressure→altitude fallback. (250/200 hPa have no fallback; they're above the 10 km axis.)
function getCloudAltitude(pressure: number, altitude: number | null): number | null {
  return altitude ?? APPROX_PRESSURE_HEIGHTS[pressure] ?? null;
}

// Mirror of CloudAndRainLane's cloudColor — single fill colour, only alpha varies with cover.
function cloudColor(cover: number, rgb: string, alphaScale: number): string {
  const alpha = (cover / 100) * alphaScale;
  return `rgba(${rgb}, ${alpha})`;
}

interface PlotLayout {
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  plotW: number;
  plotH: number;
  /** Distance (km) at the origin end of the axis (observer). */
  originDist: number;
  /** Distance (km) at the sun end of the axis. */
  farDist: number;
  maxDist: number;
  /** Lowest altitude drawn on the Y axis (km, negative → below ground). */
  minAltKm: number;
  /** Highest altitude drawn on the Y axis (km). */
  maxAltKm: number;
  /** Y of the 0 km ground line. */
  groundY: number;
  /** Vertical span (px) of the above-ground (0..maxAltKm) region. */
  aboveSpan: number;
  /** Pixels per km on the above-ground altitude axis (linear), for drawing straight rays. */
  pxPerKm: number;
}

const BASE_AXIS_MIN_ALT_KM = -8; // includes the ~7 km ground sag at 300 km
const BASE_AXIS_MAX_ALT_KM = 10; // cloud data tops out at 10 km
const SUN_HANDLE_ALT_MARGIN_KM = 1;

function makeLayout(w: number, h: number, eventType: SunEventType): PlotLayout {
  const padLeft = 34;
  const padRight = 16; // room for the draggable sun handle + rays
  const padTop = 12;
  const padBottom = 24; // room for the distance axis labels + ticks
  const plotLeft = padLeft;
  const plotRight = w - padRight;
  const plotTop = padTop;
  const plotBottom = h - padBottom;
  // Sunset: origin (0 km) on the LEFT, sun to the RIGHT (左西右东 — west on the right).
  // Sunrise: origin (0 km) on the RIGHT, sun to the LEFT (east on the left).
  const maxDist = SUN_SECTION_DISTANCES_KM[SUN_SECTION_DISTANCES_KM.length - 1] ?? 300;
  const originDist = eventType === 'sunset' ? 0 : maxDist;
  const farDist = eventType === 'sunset' ? maxDist : 0;
  // Expand the actual tangent-plane altitude range far enough to contain the sun at both drag
  // limits. Rounding outward leaves roughly 1 km around the outer rays instead of merely adding
  // blank canvas padding or pinning the handle to an unrelated screen position.
  const minSunTpaKm = maxDist * Math.tan((MIN_SUN_ALT_DEG * Math.PI) / 180);
  const maxSunTpaKm = maxDist * Math.tan((MAX_SUN_ALT_DEG * Math.PI) / 180);
  const minAltKm = Math.min(
    BASE_AXIS_MIN_ALT_KM,
    Math.floor(minSunTpaKm - SUN_HANDLE_ALT_MARGIN_KM),
  );
  const maxAltKm = Math.max(
    BASE_AXIS_MAX_ALT_KM,
    Math.ceil(maxSunTpaKm + SUN_HANDLE_ALT_MARGIN_KM),
  );
  // Reserve a proportional share of the vertical span for the below-ground band so negative
  // altitudes have real room (not zero). The 0 km line sits at plotTop + aboveSpan.
  const plotH = plotBottom - plotTop;
  const aboveSpan = (plotH * maxAltKm) / (maxAltKm - minAltKm);
  const groundY = plotTop + aboveSpan;
  // px-per-km for the above-ground axis (linear), used to draw rays as straight lines in
  // altitude-vs-distance space despite the non-linear display axis.
  const pxPerKm = aboveSpan / maxAltKm;
  return {
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    plotW: plotRight - plotLeft,
    plotH,
    originDist,
    farDist,
    maxDist,
    minAltKm,
    maxAltKm,
    groundY,
    aboveSpan,
    pxPerKm,
  };
}

function distToX(layout: PlotLayout, distanceKm: number): number {
  const t = (distanceKm - layout.originDist) / (layout.farDist - layout.originDist);
  return layout.plotLeft + t * layout.plotW;
}

// Map an altitude (km, may be negative for below-ground) to a Y on the canvas using a LINEAR
// px-per-km scale anchored at the 0 km ground line. Linear (not the timeline's 3-band nonlinear)
// so that sunlight rays — straight lines in altitude-vs-distance — stay straight AND align with
// the ground/grid/clouds (which all use this same function). No ray/ground divergence.
function altKmToY(layout: PlotLayout, altKm: number): number {
  return layout.groundY - altKm * layout.pxPerKm;
}

// Y of the curved (bulging) sea-level ground at a downrange distance. The ground sags by
// bulge(d) = d²/(2R) in the tangent plane, so on the altitude axis it dips below the 0 km line
// at the observer. Drawing the ground curved lets the sunlight rays stay straight lines.
function groundYAt(layout: PlotLayout, distanceKm: number): number {
  return altKmToY(layout, -bulgeKm(distanceKm));
}

// Fill a band that is a STRAIGHT horizontal strip in tangent-plane altitude (constant height
// above the local ground), so it reads parallel to the curved ground. Used for cloud layers,
// which sit at constant ASL → tangent-plane altitude = ASL − bulge(d).
function fillSaggingBand(
  ctx: CanvasRenderingContext2D,
  layout: PlotLayout,
  seaLevelTopKm: number,
  seaLevelBaseKm: number,
  leftDist: number,
  rightDist: number,
  fillStyle: string,
): void {
  const steps = 10;
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  for (let s = 0; s <= steps; s++) {
    const d = leftDist + ((rightDist - leftDist) * s) / steps;
    const x = distToX(layout, d);
    const y = altKmToY(layout, seaLevelTopKm - bulgeKm(d));
    if (s === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let s = steps; s >= 0; s--) {
    const d = leftDist + ((rightDist - leftDist) * s) / steps;
    const x = distToX(layout, d);
    const y = altKmToY(layout, seaLevelBaseKm - bulgeKm(d));
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCrossSection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  section: CloudSection,
  layout: PlotLayout,
  sunAltDeg: number,
  isSunset: boolean,
): void {
  const cloudFillRgb = cssVar('--cloud-fill-rgb', '90, 90, 100');
  const cloudFillAlphaScale = Number.parseFloat(cssVar('--cloud-fill-alpha-scale', '0.85')) || 0.85;
  const gridLine = cssVar('--cloud-grid-line', 'rgba(0,0,0,0.12)');
  const gridBoundary = cssVar('--cloud-grid-boundary', 'rgba(0,0,0,0.25)');
  const labelMuted = cssVar('--chart-label-muted', '#666');
  const sunFill = cssVar('--sun-cloud-sun-fill', '#f6b24a');

  const { plotLeft, plotRight, plotTop, plotBottom, plotW, groundY } = layout;
  const columns = section.columns;

  // Plot background (same as the timeline cloud lane) for the above-ground region.
  ctx.fillStyle = cssVar('--cloud-layer-bg', 'rgba(230, 232, 235, 0.3)');
  ctx.fillRect(plotLeft, plotTop, plotW, groundY - plotTop);

  // Curved ground (earth curvature): the sea-level surface sags by bulge(d) = d²/(2R) in the
  // tangent plane, so at 140 km the ground is ~1.5 km below the observer's horizon. Drawn as a
  // filled curve + line so the sunlight rays (straight) read correctly against it.
  const groundSteps = 60;
  // Collect ground-curve samples sorted by x so the fill polygon closes cleanly regardless of
  // whether the axis runs left→right (sunset) or right→left (sunrise) — otherwise the closing
  // edges cross and produce a strange self-intersecting shape at the bottom. Each sample keeps
  // its distance so the grid lines (which depend on d via bulge) stay aligned after sorting.
  const groundSamples: Array<{ d: number; x: number; y: number }> = [];
  for (let s = 0; s <= groundSteps; s++) {
    const d = (s / groundSteps) * layout.maxDist;
    groundSamples.push({ d, x: distToX(layout, d), y: groundYAt(layout, d) });
  }
  groundSamples.sort((a, b) => a.x - b.x);
  ctx.beginPath();
  for (let i = 0; i < groundSamples.length; i++) {
    const p = groundSamples[i]!;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(plotRight, plotBottom);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.closePath();
  ctx.fillStyle = cssVar('--sun-cloud-underground', 'rgba(120, 90, 60, 0.10)');
  ctx.fill();
  // Ground line (the curved horizon).
  ctx.strokeStyle = cssVar('--sun-cloud-ground-line', 'rgba(0,0,0,0.28)');
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < groundSamples.length; i++) {
    const p = groundSamples[i]!;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // Altitude grid lines (cloud boundaries thicker) — each is a constant sea-level altitude, so it
  // SAGS with the curved ground (parallel to it), including the 0 km line which coincides with
  // the ground. This keeps the ground and the 0 km grid line visually identical, so a ray ending
  // on the ground never reads as "from below ground".
  for (const alt of GRID_ALTS) {
    const isBoundary = BOUNDARY_ALTS.has(alt);
    ctx.setLineDash(isBoundary ? [6, 4] : [4, 6]);
    ctx.strokeStyle = isBoundary ? gridBoundary : gridLine;
    ctx.lineWidth = isBoundary ? 1.2 : 0.5;
    ctx.beginPath();
    for (let i = 0; i < groundSamples.length; i++) {
      const p = groundSamples[i]!;
      // Constant ASL altitude → tangent-plane altitude = ASL − bulge(d) → sags with the ground.
      const y = altKmToY(layout, alt / 1000 - bulgeKm(p.d));
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Altitude labels: on the OBSERVER side of the plot (where the user reads heights). For sunset
  // the observer is on the left, for sunrise on the right. At the observer (d = 0) bulge = 0, so
  // the labels align with the grid lines there.
  const labelOnLeft = isSunset;
  ctx.fillStyle = labelMuted;
  ctx.font = '9px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const alt of GRID_ALTS) {
    const text = alt >= 1000 ? `${alt / 1000}km` : `${alt}m`;
    const y = altKmToY(layout, alt / 1000);
    if (labelOnLeft) {
      ctx.textAlign = 'right';
      ctx.fillText(text, plotLeft - 4, y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(text, plotRight + 4, y);
    }
  }

  // Cloud layers per distance column. Each band is a sea-level altitude range that SAGS with the
  // curved ground (constant height above the local surface), so the band is filled as a curve
  // parallel to the ground rather than a flat rectangle. Columns tessellate by midpoint between
  // neighbouring sample distances (Voronoi-style) for a gap-free cross-section.
  for (let i = 0; i < columns.length; i++) {
    const col: CloudSectionColumn = columns[i]!;
    const prevDist = i > 0 ? columns[i - 1]!.distanceKm : col.distanceKm;
    const nextDist = i < columns.length - 1 ? columns[i + 1]!.distanceKm : col.distanceKm;
    const leftDist = (prevDist + col.distanceKm) / 2;
    const rightDist = (col.distanceKm + nextDist) / 2;

    const bands: Array<{ cover: number; seaLevelTopKm: number; seaLevelBaseKm: number }> = [];
    if (col.cloudByLevel) {
      for (let li = 0; li < col.cloudByLevel.length - 1; li++) {
        const lower = col.cloudByLevel[li];
        const upper = col.cloudByLevel[li + 1];
        if (!lower || !upper) continue;
        if (lower.cover == null && upper.cover == null) continue;
        const cover = Math.max(lower.cover ?? 0, upper.cover ?? 0);
        if (cover < 3) continue;
        const altLow = getCloudAltitude(lower.pressure, lower.altitude);
        const altHigh = getCloudAltitude(upper.pressure, upper.altitude);
        if (altLow == null || altHigh == null) continue;
        bands.push({ cover, seaLevelTopKm: altHigh / 1000, seaLevelBaseKm: altLow / 1000 });
      }
    } else {
      const layers = [
        { cover: col.cloudLow, seaLevelBaseKm: 0, seaLevelTopKm: 2 },
        { cover: col.cloudMid, seaLevelBaseKm: 2, seaLevelTopKm: 6 },
        { cover: col.cloudHigh, seaLevelBaseKm: 6, seaLevelTopKm: 10 },
      ];
      for (const layer of layers) {
        if (layer.cover == null || layer.cover < 3) continue;
        bands.push({
          cover: layer.cover,
          seaLevelTopKm: layer.seaLevelTopKm,
          seaLevelBaseKm: layer.seaLevelBaseKm,
        });
      }
    }
    for (const band of bands) {
      if (band.seaLevelTopKm <= band.seaLevelBaseKm) continue;
      const fill = cloudColor(band.cover, cloudFillRgb, cloudFillAlphaScale);
      fillSaggingBand(
        ctx,
        layout,
        band.seaLevelTopKm,
        band.seaLevelBaseKm,
        leftDist,
        rightDist,
        fill,
      );
    }
  }

  // Distance axis: tick labels with "km" unit, drawn in the bottom padding (outside the plot)
  // so they don't overlap the cloud plot. The last tick carries the unit.
  ctx.fillStyle = labelMuted;
  ctx.font = '9px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const distTicks = [0, 50, 100, 150, 200, 250, 300].filter((d) => d <= layout.maxDist);
  const labelY = plotBottom + 4;
  distTicks.forEach((d, i) => {
    const isLast = i === distTicks.length - 1;
    ctx.fillText(isLast ? `${d}km` : `${d}`, distToX(layout, d), labelY);
  });
  // Short tick marks at the bottom edge.
  ctx.strokeStyle = gridLine;
  ctx.lineWidth = 0.5;
  for (const d of distTicks) {
    const x = distToX(layout, d);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
  }

  // --- Sunlight: parallel rays only (no shadow/highlight fills) ---
  // Parallel rays at slope tanα. The fan includes the grazing ray (lowest ray that clears the
  // earth), so the earth-occlusion is visible: for α < 0 the near sky is dark and only far/high
  // clouds are reached. Rays are straight lines; the curved ground carries the earth curvature.
  // Clip to the plot rectangle so rays that run above the axis top render as a straight clipped
  // line (entering/exiting at the edge) rather than a flat segment that reads as a kink.
  const rays = parallelRays(layout.maxDist, sunAltDeg, layout.maxAltKm, 5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotW, plotBottom - plotTop);
  ctx.clip();
  ctx.strokeStyle = cssVar('--sun-cloud-ray', 'rgba(246,178,74,0.7)');
  ctx.lineWidth = 1;
  for (const ray of rays) {
    ctx.beginPath();
    for (let i = 0; i < ray.points.length; i++) {
      const p = ray.points[i]!;
      const px = distToX(layout, p.distanceKm);
      // The Y axis is tangent-plane altitude (TPA): ground is TPA = −bulge(d) (an arc), clouds/grid
      // are TPA = ASL − bulge(d) (arcs). A ray is STRAIGHT in TPA: TPA(d) = base + d·tanα, so plot
      // it directly — no bulge added. (Adding bulge would convert to sea-level and curve the ray.)
      const py = altKmToY(layout, p.altitudeKm);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();

  // --- Draggable sun handle at the sun end of the axis ---
  // α is the angle between the observer's local horizon (tangent to earth at d=0) and the
  // sun→observer line. The sun is at infinity in direction α, so the ray through the observer's
  // eye (d=0, h=0) has slope tan(α) in the tangent plane. At the far end (d=maxDist) its tangent-
  // plane altitude is maxDist·tan(α) — that is where the handle sits on the TPA axis, and dragging
  // it vertically inverts to α. The expanded axis keeps this physical position visible.
  const sunX = layout.farDist === 0 ? plotLeft : plotRight;
  const sunTpaKm = layout.maxDist * Math.tan((sunAltDeg * Math.PI) / 180);
  const sunY = altKmToY(layout, sunTpaKm);
  ctx.fillStyle = sunFill;
  ctx.beginPath();
  ctx.arc(sunX, sunY, SUN_DISC_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = sunFill;
  ctx.lineWidth = 1;
  for (let r = 0; r < 8; r++) {
    const ang = (r / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(
      sunX + Math.cos(ang) * SUN_RAY_INNER_RADIUS_PX,
      sunY + Math.sin(ang) * SUN_RAY_INNER_RADIUS_PX,
    );
    ctx.lineTo(
      sunX + Math.cos(ang) * SUN_RAY_OUTER_RADIUS_PX,
      sunY + Math.sin(ang) * SUN_RAY_OUTER_RADIUS_PX,
    );
    ctx.stroke();
  }
}

export default function SunDirectionCloudDrawer({
  origin,
  direction,
  sectionState,
  onClose,
}: SunDirectionCloudDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const draggingRef = useRef(false);

  // Sun altitude in degrees — the single dragged parameter. Start at the event altitude (≈0°).
  const [sunAltDeg, setSunAltDeg] = useState(direction.altitudeDeg);
  const [dragTimeMs, setDragTimeMs] = useState<number | null>(null);

  // Give useCanvas the real renderer so its resize / focus / theme redraws repaint the chart
  // after resetting the canvas bitmap dimensions.
  const paintCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!sectionState.data) return;
      const layout = makeLayout(width, height, direction.eventType);
      drawCrossSection(
        ctx,
        width,
        height,
        sectionState.data,
        layout,
        sunAltDeg,
        direction.eventType === 'sunset',
      );
    },
    [sectionState.data, sunAltDeg, direction.eventType],
  );
  const canvasRef = useCanvas(CANVAS_WIDTH, SUN_CLOUD_PLOT_HEIGHT, paintCanvas, [
    sectionState.data,
    sunAltDeg,
    direction.eventType,
  ]);

  // Reset to the event altitude when the origin/event changes.
  useEffect(() => {
    setSunAltDeg(direction.altitudeDeg);
    setDragTimeMs(null);
  }, [direction.eventTrueMs, direction.altitudeDeg]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const drawer = drawerRef.current;
      if (drawer && event.target instanceof Node && !drawer.contains(event.target)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const updateSunFromPointer = useCallback(
    (clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const y = ((clientY - rect.top) / rect.height) * SUN_CLOUD_PLOT_HEIGHT;
      const layout = makeLayout(CANVAS_WIDTH, SUN_CLOUD_PLOT_HEIGHT, direction.eventType);
      // Invert the sun-handle mapping: the dragged Y is the sun's tangent-plane altitude at the
      // far end; α = atan(TPA / maxDist).
      const sunTpaKm = (layout.groundY - y) / layout.pxPerKm;
      const alphaDeg = (Math.atan(sunTpaKm / layout.maxDist) * 180) / Math.PI;
      const clamped = Math.min(Math.max(alphaDeg, MIN_SUN_ALT_DEG), MAX_SUN_ALT_DEG);
      setSunAltDeg(clamped);

      const ms = findTimeForAltitude(origin, clamped, direction.eventTrueMs);
      setDragTimeMs(ms != null ? clampToEventWindow(ms, direction.eventTrueMs) : null);
    },
    [canvasRef, direction.eventType, direction.eventTrueMs, origin],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
    updateSunFromPointer(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    updateSunFromPointer(e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    (e.target as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
  };

  const { status, data, error } = sectionState;

  const subtitleTimeMs = dragTimeMs ?? direction.eventTrueMs;
  const subtitleTimeStr = formatLocalTime(subtitleTimeMs, origin);
  const subtitle = `${origin.cityName} · ${subtitleTimeStr} · 方位 ${Math.round(
    direction.bearingDeg,
  )}° ${bearingLabel(direction.bearingDeg)} · 太阳高度 ${sunAltDeg.toFixed(1)}°`;

  const isSunset = direction.eventType === 'sunset';
  // Sunset: observer (本站) on the LEFT, sun (west) on the RIGHT → 左西右东.
  // Sunrise: observer on the RIGHT, sun (east) on the LEFT.
  const originSideLabel = isSunset ? '本站（左）' : '本站（右）';
  const sunSideLabel = isSunset ? '日落方向（右）' : '日出方向（左）';
  const maxDistKm = SUN_SECTION_DISTANCES_KM[SUN_SECTION_DISTANCES_KM.length - 1] ?? 300;

  return (
    <div
      className="sounding-backdrop sun-cloud-backdrop"
      onClick={handleBackdropClick}
      aria-label="关闭朝日方向云况剖面"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClose();
      }}
    >
      <aside
        className="sounding-drawer sun-cloud-drawer"
        ref={drawerRef}
        aria-label="朝日方向云况剖面"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sounding-header">
          <div>
            <div className="sounding-kicker">Sun-path cross-section</div>
            <div className="sounding-title">{eventLabel(direction.eventType)}云况剖面</div>
            <div className="sounding-subtitle">{subtitle}</div>
          </div>
          <button type="button" className="sounding-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="sounding-chart-shell sun-cloud-shell">
          <div className="sounding-section-heading">
            <div>
              <div className="sounding-kicker">Cloud cross-section</div>
              <div className="sounding-section-title">高度 × 距离 云层剖面</div>
            </div>
          </div>

          {status === 'loading' && (
            <div className="sounding-empty sun-cloud-status">
              <div className="loading-spinner" />
              <span>正在加载朝日方向云况…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="sounding-empty sun-cloud-status">{error ?? '加载失败'}</div>
          )}
          {status === 'idle' && (
            <div className="sounding-empty sun-cloud-status">缺少经纬度，无法生成剖面</div>
          )}
          {status === 'success' && data && (
            <>
              <div className="sun-cloud-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={SUN_CLOUD_PLOT_HEIGHT}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  style={{ touchAction: 'none', cursor: 'ns-resize' }}
                />
                <div className="sun-cloud-axis-caption">
                  {isSunset ? (
                    <>
                      <span>本站 0km（{originSideLabel}）</span>
                      <span>
                        {maxDistKm}km → 日落（{sunSideLabel}）
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        日出（{sunSideLabel}）← {maxDistKm}km
                      </span>
                      <span>本站 0km（{originSideLabel}）</span>
                    </>
                  )}
                </div>
                <p className="sun-cloud-hint">在图上垂直拖动太阳，改变时刻并观察光路与云层相交</p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function formatLocalTime(trueMs: number, origin: WeatherPoint): string {
  const tz = origin.timezone;
  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(trueMs));
    const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hh}:${mm}`;
  } catch {
    const d = new Date(trueMs);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
}
