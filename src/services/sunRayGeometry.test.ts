import { describe, expect, it } from 'vitest';
import {
  bulgeKm,
  columnCloudBands,
  earthShadowBoundaryKm,
  grazingAltitudeKm,
  groundAltKm,
  litUndersides,
  MAX_SUN_ALT_DEG,
  MIN_SUN_ALT_DEG,
  parallelRays,
  rayCutoffDistanceKm,
} from './sunRayGeometry';
import type { CloudSection, CloudSectionColumn } from './sunCloudSection';

function column(distanceKm: number, opts: Partial<CloudSectionColumn> = {}): CloudSectionColumn {
  return {
    lat: 39.9,
    lon: 116.4,
    distanceKm,
    cloudByLevel: undefined,
    cloudLow: null,
    cloudMid: null,
    cloudHigh: null,
    ...opts,
  };
}

function section(columns: CloudSectionColumn[]): CloudSection {
  return {
    origin: { lat: 39.9, lon: 116.4 },
    eventType: 'sunset',
    eventTrueMs: 0,
    bearingDeg: 300,
    altitudeDeg: -0.8,
    columns,
  };
}

describe('sun altitude drag bounds', () => {
  it('covers civil twilight from −6° through +2°', () => {
    expect(MIN_SUN_ALT_DEG).toBe(-6);
    expect(MAX_SUN_ALT_DEG).toBe(2);
  });
});

describe('bulgeKm / groundAltKm', () => {
  it('bulge grows with distance² and ground sags negatively', () => {
    expect(bulgeKm(0)).toBe(0);
    expect(bulgeKm(140)).toBeCloseTo((140 * 140) / (2 * 6371), 4);
    expect(groundAltKm(140)).toBeCloseTo(-bulgeKm(140), 4);
  });
});

describe('earthShadowBoundaryKm', () => {
  it('is 0 for α ≥ 0 (no earth shadow when the sun is up)', () => {
    expect(earthShadowBoundaryKm(0)).toBe(0);
    expect(earthShadowBoundaryKm(6)).toBe(0);
  });

  it('is (R/2)·tan²α for α < 0 — matches the horizon-dip threshold R·α²/2 (small-angle approx)', () => {
    for (const aDeg of [-1, -2, -3, -4, -6]) {
      const tanA = Math.tan((aDeg * Math.PI) / 180);
      expect(earthShadowBoundaryKm(aDeg)).toBeCloseTo((6371 / 2) * tanA * tanA, 2);
    }
  });
});

describe('columnCloudBands', () => {
  it('expands pressure-level pairs and skips <3% cover', () => {
    const bands = columnCloudBands(
      column(10, {
        cloudByLevel: [
          { pressure: 850, cover: 50, altitude: 1500 },
          { pressure: 700, cover: 2, altitude: 3000 },
          { pressure: 500, cover: 70, altitude: 5600 },
        ],
      }),
    );
    expect(bands).toHaveLength(2);
    expect(bands[0]!.cover).toBe(50);
    expect(bands[1]!.cover).toBe(70);
  });

  it('falls back to low/mid/high bands', () => {
    const bands = columnCloudBands(column(10, { cloudLow: 20, cloudMid: 0, cloudHigh: 80 }));
    expect(bands).toHaveLength(2);
    expect(bands.map((b) => b.cover).sort((a, b) => a - b)).toEqual([20, 80]);
  });
});

describe('litUndersides', () => {
  it('during twilight lights the part of a band above the grazing ray at the observer', () => {
    // α = −2° → grazing ray at d=0 ≈ 3.9 km. A 2–6 km mid cloud is lit from 3.9 → 6 km.
    const s = section([column(0, { cloudLow: 0, cloudMid: 60, cloudHigh: 0 })]);
    const lit = litUndersides(s, -2);
    expect(lit).toHaveLength(1);
    expect(lit[0]!.litFromAltKm).toBeCloseTo(grazingAltitudeKm(0, -2), 1);
    expect(lit[0]!.band.topAltKm).toBe(6);
  });

  it('keeps a low cloud fully in shadow during deep twilight', () => {
    // α = −4° → boundary ≈ 15.5 km, above the 0–2 km low band entirely.
    const s = section([column(0, { cloudLow: 80, cloudMid: 0, cloudHigh: 0 })]);
    expect(litUndersides(s, -4)).toHaveLength(0);
  });

  it('lights the whole band when the sun is above the horizon (α ≥ 0, near column)', () => {
    // At d=0 the grazing ray is 0 for α≥0, so a low cloud there is fully lit.
    const s = section([column(0, { cloudLow: 60 })]);
    const lit = litUndersides(s, 4);
    expect(lit).toHaveLength(1);
    expect(lit[0]!.litFromAltKm).toBe(0);
  });

  it('lights a high cloud whose tangent-plane top exceeds the grazing ray at that distance', () => {
    // α = −3° → grazing ray at d=140 km ≈ 2.95 km. A 6–10 km high cloud at 140 km has tangent-plane
    // top 10 − bulge(140) ≈ 8.46 km > 2.95, base 6 − 1.54 = 4.46 km > 2.95 → lit from its base.
    const s = section([column(140, { cloudLow: 0, cloudMid: 0, cloudHigh: 80 })]);
    const lit = litUndersides(s, -3);
    expect(lit).toHaveLength(1);
    expect(lit[0]!.litFromAltKm).toBeCloseTo(6 - bulgeKm(140), 1); // tangent-plane base
    expect(lit[0]!.band.topAltKm).toBe(10);
  });

  it('during twilight lights far low clouds but not near ones (near dark, far lit)', () => {
    // α = −3°: the grazing ray is ~8.7 km at the observer (so a 2–6 km mid cloud at d=0 is in
    // shadow) but descends with distance; far out a mid cloud can clear it.
    const s = section([
      column(0, { cloudLow: 0, cloudMid: 60, cloudHigh: 0 }),
      column(140, { cloudLow: 0, cloudMid: 60, cloudHigh: 0 }),
    ]);
    const lit = litUndersides(s, -3);
    // Near column (d=0): mid cloud top 6 km < 8.7 km → not lit. Far column: grazing is lower → lit.
    expect(lit.some((l) => l.columnIndex === 0)).toBe(false);
    expect(lit.some((l) => l.columnIndex === 1)).toBe(true);
  });
});

describe('rayCutoffDistanceKm', () => {
  it('cuts the grazing ray at the horizon distance −R·tanα for α < 0', () => {
    // α = −2° → horizon distance ≈ 222 km
    const boundary = earthShadowBoundaryKm(-2);
    expect(rayCutoffDistanceKm(boundary, -2)).toBeCloseTo(222.5, 0);
  });

  it('cuts lower rays closer to the observer (near sky dark), higher rays farther (far lit)', () => {
    // α = −2°: a ray at 1 km base is cut near; a ray at 3 km base is cut far.
    expect(rayCutoffDistanceKm(1, -2)).toBeLessThan(rayCutoffDistanceKm(3, -2));
    // Rays at/above the boundary clear the earth (Infinity).
    const boundary = earthShadowBoundaryKm(-2);
    expect(Number.isFinite(rayCutoffDistanceKm(boundary, -2))).toBe(true);
    expect(rayCutoffDistanceKm(boundary + 1, -2)).toBe(Infinity);
  });

  it('returns 0 (or Infinity) for α ≥ 0 (ground never cuts a rising ray)', () => {
    expect(rayCutoffDistanceKm(0, 4)).toBe(Infinity);
    expect(rayCutoffDistanceKm(5, 4)).toBe(Infinity);
  });
});

describe('parallelRays', () => {
  it('originates at the observer; the grazing ray is the lowest and clears the earth', () => {
    const rays = parallelRays(300, -3, 10, 5);
    expect(rays.length).toBeGreaterThan(0);
    const lowest = rays.reduce((min, r) => (r.baseAltKm < min.baseAltKm ? r : min), rays[0]!);
    // The grazing ray's base at the observer is the earth-shadow boundary.
    expect(lowest.baseAltKm).toBeCloseTo(earthShadowBoundaryKm(-3), 1);
  });

  it('rays never enter the ground: the far point of each ray is at or above the ground', () => {
    const rays = parallelRays(300, -4, 10, 5);
    for (const r of rays) {
      const far = r.points[r.points.length - 1]!;
      // Sea-level altitude of the ray at its far point must be >= 0 (on/above ground).
      const farSeaLevel = far.altitudeKm + bulgeKm(far.distanceKm);
      expect(farSeaLevel).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('rays are straight lines (altitude linear in distance)', () => {
    const rays = parallelRays(300, -3, 10, 5);
    const tanA = Math.tan((-3 * Math.PI) / 180);
    for (const r of rays) {
      const slopes: number[] = [];
      for (let i = 1; i < r.points.length; i++) {
        const p0 = r.points[i - 1]!;
        const p1 = r.points[i]!;
        slopes.push((p1.altitudeKm - p0.altitudeKm) / (p1.distanceKm - p0.distanceKm));
      }
      // All slopes equal tanα (the ray is a straight line).
      for (const s of slopes) expect(s).toBeCloseTo(tanA, 5);
    }
  });

  it('always returns rays across the α range', () => {
    expect(parallelRays(300, -4, 10, 4).length).toBeGreaterThan(0);
    expect(parallelRays(300, 0, 10, 4).length).toBeGreaterThan(0);
    expect(parallelRays(300, 1.9, 10, 4).length).toBeGreaterThan(0);
  });
});
