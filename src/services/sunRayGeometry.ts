// Refracted-sunlight model for the sunset/sunrise glow cross-section.
//
// The sun is at infinity, so every ray starts with the same apparent elevation α. In a standard
// atmosphere the vertical density gradient bends visible light toward the denser air below. We use
// the conventional terrestrial-refraction approximation: ray curvature is 1/7 of Earth curvature
// (equivalently, straight-ray calculations use an effective Earth radius of 7R/6). This is a
// climatological model; inversions and strong near-surface temperature gradients can bend a real
// ray more or less. Distances/altitudes are in km; α is in degrees.
//
// Earth occlusion: the ground is not flat — it sags by bulge(d) = d²/(2R) in the tangent plane.
// A refracted ray sags toward Earth by k·bulge(d), so its clearance above sea level is
// b + d·tanα + (1−k)·bulge(d). It is CUT by the ground where that reaches 0 (see
// rayCutoffDistanceKm).
// For α < 0 this means low rays (small b) are cut close to the observer (near sky dark) while the
// GRAZING ray (b = (Reff/2)·tan²α, the earth-shadow boundary) touches the surface at
// −Reff·tanα and higher rays clear the earth to far distances — exactly the "only far clouds
// lit" behaviour of twilight.
//
// `alphaDeg` is already the apparent (refraction-corrected) Sun altitude supplied by SunCalc. The
// curvature term below propagates that observed tangent through the section; it does not add a
// second angular correction.

import type { CloudSection, CloudSectionColumn } from './sunCloudSection';
import { altitudeForPressureExport as altitudeForPressure } from './sunCloudSection';

export const EARTH_RADIUS_KM = 6371;
/** Standard visible-light terrestrial refraction: ray curvature ≈ 1/7 Earth curvature. */
export const STANDARD_REFRACTION_COEFFICIENT = 1 / 7;
/** Radius used by the equivalent straight-ray construction (7/6 of the real Earth radius). */
export const EFFECTIVE_EARTH_RADIUS_KM = EARTH_RADIUS_KM / (1 - STANDARD_REFRACTION_COEFFICIENT);
/** Default highest altitude used when building a ray fan (km). */
export const PLOT_MAX_ALT_KM = 10;
/**
 * Drag bounds for α (degrees). The useful range for this glow cross-section runs from the late
 * golden hour into civil twilight. The −6° lower bound reaches roughly 30–35 minutes before
 * sunrise (or after sunset) at mid-latitudes; beyond +2° the sun is already well above the horizon
 * for this focused view.
 */
export const MIN_SUN_ALT_DEG = -6;
export const MAX_SUN_ALT_DEG = 2;

/** Earth-curvature (bulge) drop at a downrange distance: d²/(2R), in km. */
export function bulgeKm(distanceKm: number): number {
  return (distanceKm * distanceKm) / (2 * EARTH_RADIUS_KM);
}

/** Tangent-plane altitude (km) of the ground at a downrange distance. */
export function groundAltKm(distanceKm: number): number {
  return -bulgeKm(distanceKm);
}

/** Downward departure of a standard-atmosphere light ray from its initial tangent. */
export function refractionSagKm(distanceKm: number): number {
  return STANDARD_REFRACTION_COEFFICIENT * bulgeKm(distanceKm);
}

/** Tangent-plane altitude of a refracted ray at distance `d`. */
export function refractedRayAltitudeKm(
  baseAltKm: number,
  distanceKm: number,
  alphaDeg: number,
): number {
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  return baseAltKm + distanceKm * tanA - refractionSagKm(distanceKm);
}

/** Clearance above the local sea-level surface of a refracted ray. */
export function refractedRayClearanceKm(
  baseAltKm: number,
  distanceKm: number,
  alphaDeg: number,
): number {
  return refractedRayAltitudeKm(baseAltKm, distanceKm, alphaDeg) + bulgeKm(distanceKm);
}

/**
 * Earth-shadow boundary (sea-level km) AT THE OBSERVER (d = 0): the height a cloud must exceed
 * to see the sun. α < 0 → (Reff/2)·tan²α (the refraction-aware horizon-dip threshold);
 * α ≥ 0 → 0 (no earth shadow).
 * This is the base altitude of the grazing ray; use `grazingAltitudeKm(d, α)` for the boundary
 * at an arbitrary distance.
 */
export function earthShadowBoundaryKm(alphaDeg: number): number {
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  if (tanA >= 0) return 0;
  return (EFFECTIVE_EARTH_RADIUS_KM / 2) * tanA * tanA;
}

/**
 * Altitude (sea-level km) of the GRAZING sunlight ray at a downrange distance d: the lowest
 * ray that still clears the earth. Clouds whose top exceeds this are sunlit; below it is earth
 * shadow. This is the earth-shadow boundary AS A FUNCTION OF DISTANCE:
 *   g(d) = (Reff/2)·tan²α + d·tanα + (1−k)·bulge(d)
 * For α < 0 it DESCENDS with d (near the observer only high clouds are lit; far away lower
 * clouds can be lit — the "near dark, far lit" twilight effect). The numerical result is clamped
 * to ≥ 0 at the tangent point.
 */
export function grazingAltitudeKm(distanceKm: number, alphaDeg: number): number {
  const base = earthShadowBoundaryKm(alphaDeg);
  return Math.max(0, refractedRayClearanceKm(base, distanceKm, alphaDeg));
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
  /** Tangent-plane altitude (km) where the lit portion of the underside begins. */
  litFromAltKm: number;
  band: CloudBand;
}

/**
 * Cloud bands whose UNDERSIDE is sunlit at altitude α. The cloud and grazing-ray heights are
 * compared in the sea-level frame. For α < 0 this means near the observer only high clouds clear
 * the boundary, while farther-away lower clouds can be lit. `litFromAltKm` is converted to the
 * tangent-plane frame used by the renderer.
 */
export function litUndersides(section: CloudSection, alphaDeg: number): LitUnderside[] {
  const result: LitUnderside[] = [];
  section.columns.forEach((col, i) => {
    const boundary = grazingAltitudeKm(col.distanceKm, alphaDeg);
    for (const band of columnCloudBands(col)) {
      if (band.topAltKm <= boundary) continue; // entirely below the grazing ray (in shadow)
      // Return tangent-plane altitude for the renderer, after doing the illumination comparison in
      // the shared sea-level frame. (The old implementation mixed these two frames at d > 0.)
      const litFrom = Math.max(band.baseAltKm, boundary) - bulgeKm(col.distanceKm);
      result.push({ columnIndex: i, litFromAltKm: litFrom, band });
    }
  });
  return result;
}

/**
 * Distance (km) at which a parallel ray of base altitude b (sea-level km at the observer) meets
 * the ground and is cut, for apparent sun altitude α. The ray's sea-level clearance at distance
 * d is b + d·tanα + d²/(2Reff); setting that to 0 gives
 * d = −Reff·tanα ± Reff·√(tan²α − 2b/Reff). Returns Infinity
 * when the ray never meets the ground (b ≥ earth-shadow boundary, i.e. the ray clears the earth).
 *
 * This is the earth-occlusion: for α < 0, low rays (small b) are cut close to the observer (near
 * sky dark) while the grazing ray (b = boundary) is cut at the horizon distance −Reff·tanα and
 * higher rays reach all the way (far clouds lit).
 */
export function rayCutoffDistanceKm(baseAltKm: number, alphaDeg: number): number {
  const tanA = Math.tan((alphaDeg * Math.PI) / 180);
  if (tanA >= 0) return Infinity; // rising ray never meets the ground
  const disc = tanA * tanA - (2 * baseAltKm) / EFFECTIVE_EARTH_RADIUS_KM;
  if (disc < -1e-12) return Infinity; // ray clears the bulging earth everywhere
  const sqrt = Math.sqrt(Math.max(0, disc));
  const d1 = -EFFECTIVE_EARTH_RADIUS_KM * tanA - EFFECTIVE_EARTH_RADIUS_KM * sqrt;
  const d2 = -EFFECTIVE_EARTH_RADIUS_KM * tanA + EFFECTIVE_EARTH_RADIUS_KM * sqrt;
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
 * Build a fan of initially parallel, downward-refracting rays ORIGINATING AT THE OBSERVER (d = 0)
 * and traced toward the sun (increasing d). Every ray follows the same standard-atmosphere
 * curvature; the fan spans the lit altitude range at the observer.
 *
 * Bases at the observer:
 *  - α < 0: the lowest ray is the GRAZING ray (tangent to the earth), base = earth-shadow
 *    boundary (Reff/2)·tan²α. Below it is earth's shadow (no direct light); it descends with d
 *    and touches the surface at −Reff·tanα. Higher rays spread up to maxAlt.
 *  - α ≥ 0: the lowest ray is at ground level (base 0); higher rays spread up to maxAlt.
 *
 * Each ray is clipped to its ground-cutoff distance (where it meets the curved earth) so it never
 * enters the ground. The actual Earth and the smaller downward ray curvature are both drawn.
 */
export function parallelRays(
  maxDistKm: number,
  alphaDeg: number,
  maxAltKm: number = PLOT_MAX_ALT_KM,
  count: number = 4,
): ParallelRay[] {
  if (count <= 1) return [];
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
      // Tangent-plane altitude of the refracted ray. NOT clamped: the draw layer clips the plot,
      // while preserving the physical curve at the frame edge.
      const alt = refractedRayAltitudeKm(baseAlt, d, alphaDeg);
      pts.push({ distanceKm: d, altitudeKm: alt });
    }
    if (pts.length >= 2) rays.push({ baseAltKm: baseAlt, cutoffKm: cutoff, points: pts });
  }
  return rays;
}
