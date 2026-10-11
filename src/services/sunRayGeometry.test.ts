import { describe, expect, it } from 'vitest';
import {
  bulgeKm,
  columnCloudBands,
  EFFECTIVE_EARTH_RADIUS_KM,
  earthShadowBoundaryKm,
  grazingAltitudeKm,
  groundAltKm,
  litUndersides,
  MAX_SUN_ALT_DEG,
  MIN_SUN_ALT_DEG,
  parallelRays,
  rayCutoffDistanceKm,
  refractedRayAltitudeKm,
  refractionSagKm,
  sectionGroundAltitudeKm,
  STANDARD_REFRACTION_COEFFICIENT,
} from './sunRayGeometry';
import type { CloudSection, CloudSectionColumn } from './sunCloudSection';

function column(distanceKm: number, opts: Partial<CloudSectionColumn> = {}): CloudSectionColumn {
  return {
    lat: 39.9,
    lon: 116.4,
    distanceKm,
    elevation: null,
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

  it('bends standard-atmosphere light downward by one seventh of Earth curvature', () => {
    expect(STANDARD_REFRACTION_COEFFICIENT).toBeCloseTo(1 / 7, 10);
    expect(EFFECTIVE_EARTH_RADIUS_KM).toBeCloseTo((6371 * 7) / 6, 6);
    expect(refractionSagKm(300)).toBeCloseTo(bulgeKm(300) / 7, 6);
    expect(refractedRayAltitudeKm(5, 300, 0)).toBeCloseTo(5 - refractionSagKm(300), 6);
  });
});

describe('earthShadowBoundaryKm', () => {
  it('is 0 for α ≥ 0 (no earth shadow when the sun is up)', () => {
    expect(earthShadowBoundaryKm(0)).toBe(0);
    expect(earthShadowBoundaryKm(6)).toBe(0);
  });

  it('uses the 7R/6 effective radius for a refraction-aware horizon-dip threshold', () => {
    for (const aDeg of [-1, -2, -3, -4, -6]) {
      const tanA = Math.tan((aDeg * Math.PI) / 180);
      expect(earthShadowBoundaryKm(aDeg)).toBeCloseTo(
        (EFFECTIVE_EARTH_RADIUS_KM / 2) * tanA * tanA,
        2,
      );
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

  it('drops pressure levels below the column terrain and cuts a straddling band', () => {
    // A 3.6 km plateau: 1000–700 hPa are underground, 600 hPa is 0.8 km above the ground.
    const levels = [
      { pressure: 1000, cover: 30, altitude: 173 },
      { pressure: 850, cover: 34, altitude: 1543 },
      { pressure: 700, cover: 42, altitude: 3153 },
      { pressure: 600, cover: 0, altitude: 4411 },
    ];
    expect(columnCloudBands(column(0, { elevation: 3603, cloudByLevel: levels }))).toEqual([]);

    // A band that straddles the terrain is cut at the ground and keeps the above-ground cover.
    expect(
      columnCloudBands(
        column(0, {
          elevation: 3603,
          cloudByLevel: [
            { pressure: 700, cover: 42, altitude: 3153 },
            { pressure: 600, cover: 25, altitude: 4411 },
          ],
        }),
      ),
    ).toEqual([{ baseAltKm: 3.603, topAltKm: 4.411, cover: 25 }]);
  });

  it('uses the ground-relative low/mid/high classes when no level has cover', () => {
    const bands = columnCloudBands(column(0, { elevation: 3603, cloudLow: 100, cloudMid: 0 }));

    expect(bands).toEqual([{ baseAltKm: 3.603, topAltKm: 6.603, cover: 100 }]);
  });
});

describe('litUndersides', () => {
  it('during twilight lights the part of a band above the grazing ray at the observer', () => {
    // α = −2° → refracted grazing ray at d=0 ≈ 4.5 km. A 3–8 km mid cloud is partly lit.
    const s = section([column(0, { cloudLow: 0, cloudMid: 60, cloudHigh: 0 })]);
    const lit = litUndersides(s, -2);
    expect(lit).toHaveLength(1);
    expect(lit[0]!.litFromAltKm).toBeCloseTo(grazingAltitudeKm(0, -2), 1);
    expect(lit[0]!.band.topAltKm).toBe(8);
  });

  it('keeps a low cloud fully in shadow during deep twilight', () => {
    // α = −4° → refraction-aware boundary ≈ 18.2 km, above the 0–2 km low band entirely.
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
    // α = −3° → grazing ray at d=140 km is below an 8–10 km high-cloud band, so the whole band is
    // lit and its returned drawing altitude is converted to the tangent plane.
    const s = section([column(140, { cloudLow: 0, cloudMid: 0, cloudHigh: 80 })]);
    const lit = litUndersides(s, -3);
    expect(lit).toHaveLength(1);
    expect(lit[0]!.litFromAltKm).toBeCloseTo(8 - bulgeKm(140), 1); // tangent-plane base
    expect(lit[0]!.band.topAltKm).toBe(10);
  });

  it('during twilight lights far low clouds but not near ones (near dark, far lit)', () => {
    // α = −3°: the grazing ray is ~10.2 km at the observer (so a 2–6 km mid cloud at d=0 is in
    // shadow) but descends with distance; far out a mid cloud can clear it.
    const s = section([
      column(0, { cloudLow: 0, cloudMid: 60, cloudHigh: 0 }),
      column(140, { cloudLow: 0, cloudMid: 60, cloudHigh: 0 }),
    ]);
    const lit = litUndersides(s, -3);
    // Near column (d=0): mid cloud top 6 km < 10.2 km → not lit. Far column: boundary is lower.
    expect(lit.some((l) => l.columnIndex === 0)).toBe(false);
    expect(lit.some((l) => l.columnIndex === 1)).toBe(true);
  });
});

describe('rayCutoffDistanceKm', () => {
  it('cuts the grazing ray at the refracted horizon distance −Reff·tanα for α < 0', () => {
    const boundary = earthShadowBoundaryKm(-2);
    const expected = -EFFECTIVE_EARTH_RADIUS_KM * Math.tan((-2 * Math.PI) / 180);
    expect(rayCutoffDistanceKm(boundary, -2)).toBeCloseTo(expected, 0);
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

  it('curves rays downward by the standard refraction sag', () => {
    const rays = parallelRays(300, -3, 10, 5);
    const tanA = Math.tan((-3 * Math.PI) / 180);
    for (const r of rays) {
      const far = r.points[r.points.length - 1]!;
      expect(far.altitudeKm).toBeCloseTo(
        r.baseAltKm + far.distanceKm * tanA - refractionSagKm(far.distanceKm),
        6,
      );
      if (far.distanceKm > 0) {
        expect(far.altitudeKm).toBeLessThan(r.baseAltKm + far.distanceKm * tanA);
      }
    }
  });

  it('always returns rays across the α range', () => {
    expect(parallelRays(300, -4, 10, 4).length).toBeGreaterThan(0);
    expect(parallelRays(300, 0, 10, 4).length).toBeGreaterThan(0);
    expect(parallelRays(300, 1.9, 10, 4).length).toBeGreaterThan(0);
  });

  it('lifts the whole fan onto the observer terrain while keeping bases ground-relative', () => {
    const groundAltKm = 3.603;
    const plateau = parallelRays(300, -3, 10, 5, groundAltKm);
    const seaLevel = parallelRays(300, -3, 10, 5, 0);
    expect(plateau).toHaveLength(seaLevel.length);

    plateau.forEach((ray, index) => {
      const flat = seaLevel[index]!;
      // Bases stay measured above the local ground (they drive slant extinction)…
      expect(ray.baseAltKm).toBeCloseTo(flat.baseAltKm, 9);
      // …while the drawn points sit on the observer's terrain frame.
      ray.points.forEach((point, pointIndex) => {
        expect(point.altitudeKm).toBeCloseTo(flat.points[pointIndex]!.altitudeKm + groundAltKm, 9);
      });
    });
  });
});

describe('sectionGroundAltitudeKm', () => {
  it('reads the observer terrain from the d = 0 column', () => {
    const s = section([column(0, { elevation: 3603 }), column(20, { elevation: 4209 })]);
    expect(sectionGroundAltitudeKm(s)).toBeCloseTo(3.603, 9);
  });

  it('falls back to sea level when the section has no elevation', () => {
    expect(sectionGroundAltitudeKm(section([column(0)]))).toBe(0);
    expect(sectionGroundAltitudeKm(section([]))).toBe(0);
  });
});

describe('litUndersides on high terrain', () => {
  it('keeps a cloud a sea-level observer sees lit inside the earth shadow on a plateau', () => {
    // Same 6–8 km ASL layer, α = −2°: the grazing ray clears 4.5 km above a sea-level observer (so
    // the layer is lit) but 3.6 km higher from a 3.6 km plateau (8.1 km), above the layer top.
    const levels = [
      { pressure: 600, cover: 60, altitude: 6000 },
      { pressure: 500, cover: 60, altitude: 8000 },
    ];
    const flat = section([column(0, { cloudByLevel: levels })]);
    expect(litUndersides(flat, -2)).toHaveLength(1);

    const plateau = section([column(0, { elevation: 3603, cloudByLevel: levels })]);
    expect(litUndersides(plateau, -2)).toHaveLength(0);
  });

  it('shifts the lit-from altitude by the terrain', () => {
    // A ground-relative mid layer on a 3.6 km plateau spans 6.6–11.6 km ASL; the plateau boundary
    // at α = −2° is 3.6 + 4.5 km, so the layer is lit from 8.1 km ASL (vs 4.5 km from sea level).
    const plateau = section([column(0, { elevation: 3603, cloudMid: 60 })]);
    const lit = litUndersides(plateau, -2);
    expect(lit).toHaveLength(1);
    expect(lit[0]!.litFromAltKm).toBeCloseTo(3.603 + grazingAltitudeKm(0, -2), 1);
  });
});
