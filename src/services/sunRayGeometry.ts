// Parallel-sunlight model for the sunset/sunrise glow cross-section.
//
// The sun is at infinity → sunlight is a bundle of PARALLEL rays all at slope tan(α) in the
// (distance, altitude) plane, α = sun altitude angle. What matters is the ANGLE, not a sun
// position. Distances/altitudes in km; α in degrees.
//
// Earth occlusion: the ground is not flat — it sags by bulge(d) = d²/(2R) in the tangent plane.
// A parallel ray of base altitude b (sea-level at the observer) has sea-level altitude
// b + d·tanα + bulge(d); it is CUT by the ground where that reaches 0 (see rayCutoffDistanceKm).
// For α < 0 this means low rays (small b) are cut close to the observer (near sky dark) while the
// GRAZING ray (b = (R/2)·tan²α, the earth-shadow boundary) is cut at the horizon distance
// −R·tanα and higher rays clear the earth to far distances — exactly the "only far clouds lit"
// behaviour of twilight.
//
// The earth-shadow boundary (R/2)·tan²α is also the threshold above which cloud UNDERSIDES are
// sunlit (the horizon-dip threshold: a cloud at height h sees the sun iff |α| < √(2h/R)). It is
// distance-independent because the sun altitude is ~constant along a 140 km line.

import type { CloudSection, CloudSectionColumn } from './sunCloudSection';
import { altitudeForPressureExport as altitudeForPressure } from './sunCloudSection';

export const EARTH_RADIUS_KM = 6371;
/** Default highest altitude used when building a ray fan (km). */
export const PLOT_MAX_ALT_KM = 10;
/**
 * Drag bounds for α (degrees). The useful range for this glow cross-section runs from the late
 * golden hour into civil twilight. At −3° only the highest clouds near the observer still receive
 * direct light; beyond +2° the sun is already well above the horizon for this focused view.
 */
export const MIN_SUN_ALT_DEG = -3;
export const MAX_SUN_ALT_DEG = 2;

/** Earth-curvature (bulge) drop at a downrange distance: d²/(2R), in km. */
export function bulgeKm(distanceKm: number): number {
  return (distanceKm * distanceKm) / (2 * EARTH_RADIUS_KM);
}

/** Tangent-plane altitude (km) of the ground at a downrange distance. */
export function groundAltKm(distanceKm: number): number {
  return -bulgeKm(distanceKm);
}

/**
 * Earth-shadow boundary (sea-level km) AT THE OBSERVER (d = 0): the height a cloud must exceed
 * to see the sun. α < 0 → (R/2)·tan²α (the horizon-dip threshold); α ≥ 0 → 0 (no earth shadow).
 * This is the base altitude of the grazing ray; use `grazingAltitudeKm(d, α)` for the boundary
 * at an arbitrary distance.
 */
export function earthShadowBoundaryKm(alphaDeg: number): number {
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  if (tanA >= 0) return 0;
  return (EARTH_RADIUS_KM / 2) * tanA * tanA;
}

/**
 * Altitude (sea-level km) of the GRAZING sunlight ray at a downrange distance d: the lowest
 * ray that still clears the earth. Clouds whose top exceeds this are sunlit; below it is earth
 * shadow. This is the earth-shadow boundary AS A FUNCTION OF DISTANCE:
 *   g(d) = (R/2)·tan²α + d·tanα + bulge(d)
 * For α < 0 it DESCENDS with d (near the observer only high clouds are lit; far away lower
 * clouds can be lit — the "near dark, far lit" twilight effect). For α ≥ 0 it is ≥ 0 everywhere.
 * Clamped to ≥ 0 (beyond the horizon the grazing ray is below ground — total darkness).
 */
export function grazingAltitudeKm(distanceKm: number, alphaDeg: number): number {
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  const base = earthShadowBoundaryKm(alphaDeg);
  return Math.max(0, base + distanceKm * tanA + bulgeKm(distanceKm));
}

export interface CloudBand {
  baseAltKm: number;
  topAltKm: number;
  cover: number;
}

/** Expand a column's cloud cover into drawable [base, top] bands (mirrors CloudAndRainLane). */
export function columnCloudBands(col: CloudSectionColumn): CloudBand[] {
  if (col.cloudByLevel && col.cloudByLevel.length > 0) {
    const bands: CloudBand[] = [];
    for (let li = 0; li < col.cloudByLevel.length - 1; li++) {
      const lower = col.cloudByLevel[li];
      const upper = col.cloudByLevel[li + 1];
      if (!lower || !upper) continue;
      if (lower.cover == null && upper.cover == null) continue;
      const cover = Math.max(lower.cover ?? 0, upper.cover ?? 0);
      if (cover < 3) continue;
      const altLow = altitudeForPressure(lower.pressure, lower.altitude);
      const altHigh = altitudeForPressure(upper.pressure, upper.altitude);
      if (altLow == null || altHigh == null) continue;
      bands.push({ baseAltKm: altLow / 1000, topAltKm: altHigh / 1000, cover });
    }
    return bands;
  }
  const layers = [
    { cover: col.cloudLow, baseAltKm: 0, topAltKm: 2 },
    { cover: col.cloudMid, baseAltKm: 2, topAltKm: 6 },
    { cover: col.cloudHigh, baseAltKm: 6, topAltKm: 10 },
  ];
  const bands: CloudBand[] = [];
  for (const layer of layers) {
    if (layer.cover == null || layer.cover < 3) continue;
    bands.push({ baseAltKm: layer.baseAltKm, topAltKm: layer.topAltKm, cover: layer.cover });
  }
  return bands;
}

export interface LitUnderside {
  columnIndex: number;
  /** Altitude (sea-level km) where the lit portion of the underside begins (= max(base, boundary)). */
  litFromAltKm: number;
  band: CloudBand;
}

/**
 * Cloud bands whose UNDERSIDE is sunlit at altitude α. A band is lit where its tangent-plane
 * altitude (sea-level altitude − bulge) exceeds the grazing ray there. For α < 0 this means near
 * the observer only high clouds clear the boundary, far away lower clouds do — the "near dark,
 * far lit" twilight effect. `litFromAltKm` is the tangent-plane altitude where the lit portion
 * begins; for drawing on the tangent-plane axis it is used directly.
 */
export function litUndersides(section: CloudSection, alphaDeg: number): LitUnderside[] {
  const result: LitUnderside[] = [];
  section.columns.forEach((col, i) => {
    const boundary = grazingAltitudeKm(col.distanceKm, alphaDeg);
    const bulge = bulgeKm(col.distanceKm);
    for (const band of columnCloudBands(col)) {
      const topTpa = band.topAltKm - bulge; // band top in tangent-plane altitude
      if (topTpa <= boundary) continue; // entirely below the grazing ray (in shadow)
      const baseTpa = band.baseAltKm - bulge;
      const litFrom = Math.max(baseTpa, boundary);
      result.push({ columnIndex: i, litFromAltKm: litFrom, band });
    }
  });
  return result;
}

/**
 * Distance (km) at which a parallel ray of base altitude b (sea-level km at the observer) meets
 * the ground and is cut, for sun altitude α. The ray's sea-level altitude at distance d is
 * b + d·tanα + bulge(d); setting that to 0 gives d = −R·tanα ± R·√(tan²α − 2b/R). Returns Infinity
 * when the ray never meets the ground (b ≥ earth-shadow boundary, i.e. the ray clears the earth).
 *
 * This is the earth-occlusion: for α < 0, low rays (small b) are cut close to the observer (near
 * sky dark) while the grazing ray (b = boundary) is cut at the horizon distance −R·tanα and
 * higher rays reach all the way (far clouds lit).
 */
export function rayCutoffDistanceKm(baseAltKm: number, alphaDeg: number): number {
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  if (tanA >= 0) return Infinity; // rising ray never meets the ground
  const disc = tanA * tanA - (2 * baseAltKm) / EARTH_RADIUS_KM;
  if (disc < 0) return Infinity; // ray clears the bulging earth everywhere
  const sqrt = Math.sqrt(disc);
  const d1 = -EARTH_RADIUS_KM * tanA - EARTH_RADIUS_KM * sqrt;
  const d2 = -EARTH_RADIUS_KM * tanA + EARTH_RADIUS_KM * sqrt;
  const candidates = [d1, d2].filter((d) => d >= 0);
  return candidates.length > 0 ? Math.min(...candidates) : Infinity;
}

export interface RayPoint {
  distanceKm: number;
  altitudeKm: number;
}

export interface ParallelRay {
  /** Altitude (sea-level km) of the ray at the observer (d = 0). */
  baseAltKm: number;
  /** Distance (km) at which the ray meets the ground and is cut (Infinity if it clears the earth). */
  cutoffKm: number;
  points: RayPoint[];
}

/**
 * Build a fan of parallel rays at slope tanα, ORIGINATING AT THE OBSERVER (d = 0) and traced
 * toward the sun (increasing d). Each ray is a STRAIGHT line; the fan spans the lit altitude
 * range at the observer.
 *
 * Bases at the observer:
 *  - α < 0: the lowest ray is the GRAZING ray (tangent to the earth), base = earth-shadow
 *    boundary (R/2)·tan²α. Below it is earth's shadow (no direct light); it descends with d and
 *    is cut at the horizon distance −R·tanα. Higher rays spread up to maxAlt.
 *  - α ≥ 0: the lowest ray is at ground level (base 0); higher rays spread up to maxAlt.
 *
 * Each ray is clipped to its ground-cutoff distance (where it meets the curved earth) so it
 * never enters the ground. Rays are straight lines in altitude-vs-distance; the curved ground
 * (drawn separately) carries the earth curvature.
 */
export function parallelRays(
  maxDistKm: number,
  alphaDeg: number,
  maxAltKm: number = PLOT_MAX_ALT_KM,
  count: number = 4,
): ParallelRay[] {
  if (count <= 1) return [];
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  const boundary = earthShadowBoundaryKm(alphaDeg);
  // Observer-side bases. The lowest ray is the grazing ray (base = boundary), even when boundary
  // exceeds the axis top (it exits the top of the plot near d = 0 and re-enters partway downrange
  // as it descends — that re-entry is exactly the far clouds being lit). Higher rays spread up
  // from the grazing ray; we space them by maxAlt so the fan covers the axis wherever it is lit.
  const lo = Math.max(0, boundary);
  const bases: number[] = [];
  for (let r = 0; r < count; r++) {
    bases.push(lo + (maxAltKm * r) / (count - 1));
  }
  const rays: ParallelRay[] = [];
  for (const baseAlt of bases) {
    const cutoff = rayCutoffDistanceKm(baseAlt, alphaDeg);
    // Skip rays already underground at the observer (base below the boundary → in earth's shadow).
    if (baseAlt < boundary - 1e-9) continue;
    // Clip the ray to its ground-cutoff so it never enters the earth.
    if (Number.isFinite(cutoff) && cutoff <= 0) continue;
    const endDist = Number.isFinite(cutoff) ? Math.min(cutoff, maxDistKm) : maxDistKm;
    const pts: RayPoint[] = [];
    const steps = 120;
    for (let s = 0; s <= steps; s++) {
      const d = (s / steps) * endDist;
      // Tangent-plane altitude of this straight ray at distance d. NOT clamped — the drawn line
      // must stay straight; the draw layer clips the Y to the plot so values above the axis top
      // or below 0 render as a straight (clipped) line, not a kinked one.
      const alt = baseAlt + d * tanA;
      pts.push({ distanceKm: d, altitudeKm: alt });
    }
    if (pts.length >= 2) rays.push({ baseAltKm: baseAlt, cutoffKm: cutoff, points: pts });
  }
  return rays;
}
