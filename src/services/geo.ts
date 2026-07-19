// Spherical-earth geometry helpers for the sun-direction cloud cross-section.
// Distances/altitudes are in km; bearings in degrees (0 = north, clockwise).

export const EARTH_RADIUS_KM = 6371;

export interface LatLng {
  lat: number;
  lon: number;
}

export interface SamplePoint extends LatLng {
  distanceKm: number;
}

/**
 * Destination point reached by travelling `distanceKm` from the origin along
 * `bearingDeg` (compass bearing, 0 = north, clockwise). Great-circle / spherical
 * earth. Returns lat/lon in degrees.
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): LatLng {
  const angularDist = distanceKm / EARTH_RADIUS_KM; // radians
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const sinLat2 =
    Math.sin(lat1) * Math.cos(angularDist) +
    Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearing);
  const lat2 = Math.asin(sinLat2);
  const y = Math.sin(bearing) * Math.sin(angularDist) * Math.cos(lat1);
  const x = Math.cos(angularDist) - Math.sin(lat1) * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Sample points along a straight bearing from the origin at the given distances.
 * Distance 0 returns a copy of the origin.
 */
export function sampleLineAlong(
  origin: LatLng,
  bearingDeg: number,
  distancesKm: readonly number[],
): SamplePoint[] {
  return distancesKm.map((distanceKm) => {
    if (distanceKm <= 0) {
      return { lat: origin.lat, lon: origin.lon, distanceKm: 0 };
    }
    return { ...destinationPoint(origin.lat, origin.lon, bearingDeg, distanceKm), distanceKm };
  });
}

const COMPASS_LABELS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] as const;

/**
 * Eight-wind compass label for a bearing (e.g. 90 -> 东, 270 -> 西).
 */
export function bearingLabel(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_LABELS[index] ?? '北';
}
