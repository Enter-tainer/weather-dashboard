import { describe, expect, it } from 'vitest';
import { bearingLabel, destinationPoint, EARTH_RADIUS_KM, sampleLineAlong } from './geo';

describe('destinationPoint', () => {
  it('moves due north by ~0.009° per km (latitude), longitude unchanged', () => {
    const { lat, lon } = destinationPoint(39.9, 116.4, 0, 1);
    expect(lat).toBeCloseTo(39.9 + 1 / 111.195, 3);
    expect(lon).toBeCloseTo(116.4, 5);
  });

  it('moves due south, decreasing latitude', () => {
    const { lat } = destinationPoint(39.9, 116.4, 180, 1);
    expect(lat).toBeCloseTo(39.9 - 1 / 111.195, 3);
  });

  it('moves due east by ~0.5° longitude for 50 km at ~40°N', () => {
    const { lat, lon } = destinationPoint(39.9, 116.4, 90, 50);
    // Great-circle due-east curves very slightly; latitude stays near 39.9.
    expect(lat).toBeCloseTo(39.9, 1);
    // 50 km east at lat 39.9: lon delta = 50 / (111.195 * cos(39.9°))
    const expected = 50 / (111.195 * Math.cos((39.9 * Math.PI) / 180));
    expect(lon - 116.4).toBeCloseTo(expected, 1);
  });

  it('produces a point at the requested great-circle distance from the origin', () => {
    const origin = { lat: 20, lon: 120 };
    const dest = destinationPoint(origin.lat, origin.lon, 137, 300);
    // Spherical haversine distance should match 300 km.
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(dest.lat - origin.lat);
    const dLon = toRad(dest.lon - origin.lon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.lat)) * Math.cos(toRad(dest.lat)) * Math.sin(dLon / 2) ** 2;
    const dist = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
    expect(dist).toBeCloseTo(300, 0);
  });

  it('0 km returns the origin', () => {
    const { lat, lon } = destinationPoint(39.9, 116.4, 90, 0);
    expect(lat).toBeCloseTo(39.9, 8);
    expect(lon).toBeCloseTo(116.4, 8);
  });
});

describe('sampleLineAlong', () => {
  it('returns one point per distance, first being the origin', () => {
    const pts = sampleLineAlong({ lat: 39.9, lon: 116.4 }, 90, [0, 10, 20]);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ lat: 39.9, lon: 116.4, distanceKm: 0 });
    expect(pts[1]?.distanceKm).toBe(10);
    expect(pts[2]?.distanceKm).toBe(20);
  });

  it('walks monotonically along a constant bearing', () => {
    const pts = sampleLineAlong({ lat: 0, lon: 0 }, 45, [0, 100, 200]);
    expect(pts[1]!.lat).toBeGreaterThan(0);
    expect(pts[1]!.lon).toBeGreaterThan(0);
    expect(pts[2]!.lat).toBeGreaterThan(pts[1]!.lat);
  });
});

describe('bearingLabel', () => {
  it.each([
    [0, '北'],
    [45, '东北'],
    [90, '东'],
    [135, '东南'],
    [180, '南'],
    [225, '西南'],
    [270, '西'],
    [300, '西北'],
    [315, '西北'],
    [360, '北'],
    [-90, '西'],
  ])('bearing %i° -> %s', (bearing, label) => {
    expect(bearingLabel(bearing)).toBe(label);
  });
});

describe('EARTH_RADIUS_KM', () => {
  it('is the canonical mean earth radius', () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
  });
});
