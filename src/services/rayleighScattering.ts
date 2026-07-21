import { EARTH_RADIUS_KM } from './sunRayGeometry';

// A compact clear-air model for colouring the direct solar beam. It deliberately models only
// molecular (Rayleigh) extinction; aerosol, ozone, refraction, and multiple scattering are not
// included. The spherical path integration remains valid across the drawer's +2°..−6° range,
// where plane-parallel 1/sin(elevation) air-mass approximations break down.

const ATMOSPHERE_SCALE_HEIGHT_KM = 8.4;
const ATMOSPHERE_TOP_KM = 100;
const INTEGRATION_STEP_KM = 2;
const MAX_PATH_KM = 4000;
const MAX_VISUAL_AIR_MASS = 120;

const RGB_WAVELENGTHS_UM = {
  red: 0.65,
  green: 0.55,
  blue: 0.45,
} as const;

export interface LinearRgb {
  red: number;
  green: number;
  blue: number;
}

export interface RayleighRayStyle {
  airMass: number;
  linearTransmission: LinearRgb;
  cssColor: string;
}

function atmosphericDensity(relativeAltitudeKm: number): number {
  if (relativeAltitudeKm <= 0) return 1;
  if (relativeAltitudeKm >= ATMOSPHERE_TOP_KM) return 0;
  return Math.exp(-relativeAltitudeKm / ATMOSPHERE_SCALE_HEIGHT_KM);
}

function radialAltitudeKm(xKm: number, tangentPlaneAltitudeKm: number): number {
  return Math.hypot(xKm, EARTH_RADIUS_KM + tangentPlaneAltitudeKm) - EARTH_RADIUS_KM;
}

/**
 * Relative optical air mass from a point on a parallel ray toward the Sun.
 *
 * The start point is at x=0 in the observer's tangent plane and `baseAltitudeKm` above that
 * plane. The Sun lies toward +x at `sunAltitudeDeg`. Density follows an exponential atmosphere,
 * while altitude is evaluated against a spherical Earth. The result is normalized by the
 * sea-level vertical atmospheric column, so a vertical ray from sea level is approximately 1.
 */
export function sphericalRayAirMass(baseAltitudeKm: number, sunAltitudeDeg: number): number {
  if (!Number.isFinite(baseAltitudeKm) || !Number.isFinite(sunAltitudeDeg)) return 1;

  const angleRad = (sunAltitudeDeg * Math.PI) / 180;
  const directionX = Math.cos(angleRad);
  const directionY = Math.sin(angleRad);
  let previousAltitude = radialAltitudeKm(0, baseAltitudeKm);
  if (previousAltitude < 0) return Infinity;
  let previousDensity = atmosphericDensity(previousAltitude);
  let integratedDensityKm = 0;
  let exitedAtmosphere = previousAltitude >= ATMOSPHERE_TOP_KM && directionY >= 0;

  for (
    let sKm = INTEGRATION_STEP_KM;
    !exitedAtmosphere && sKm <= MAX_PATH_KM;
    sKm += INTEGRATION_STEP_KM
  ) {
    const xKm = sKm * directionX;
    const yKm = baseAltitudeKm + sKm * directionY;
    const altitudeKm = radialAltitudeKm(xKm, yKm);
    if (altitudeKm < -1e-6) return Infinity;

    const density = atmosphericDensity(altitudeKm);
    integratedDensityKm += ((previousDensity + density) * INTEGRATION_STEP_KM) / 2;
    exitedAtmosphere = altitudeKm >= ATMOSPHERE_TOP_KM && altitudeKm > previousAltitude;
    previousAltitude = altitudeKm;
    previousDensity = density;
  }

  const verticalColumnKm =
    ATMOSPHERE_SCALE_HEIGHT_KM * (1 - Math.exp(-ATMOSPHERE_TOP_KM / ATMOSPHERE_SCALE_HEIGHT_KM));
  return integratedDensityKm / verticalColumnKm;
}

/** Standard-atmosphere Rayleigh vertical optical depth; wavelength is in micrometres. */
export function rayleighOpticalDepth(wavelengthUm: number): number {
  if (!Number.isFinite(wavelengthUm) || wavelengthUm <= 0) return Infinity;
  const inverseSquared = 1 / (wavelengthUm * wavelengthUm);
  const inverseFourth = inverseSquared * inverseSquared;
  return 0.008569 * inverseFourth * (1 + 0.0113 * inverseSquared + 0.00013 * inverseFourth);
}

export function rayleighTransmissionRgb(relativeAirMass: number): LinearRgb {
  const airMass = Math.max(0, Math.min(relativeAirMass, MAX_VISUAL_AIR_MASS));
  return {
    red: Math.exp(-airMass * rayleighOpticalDepth(RGB_WAVELENGTHS_UM.red)),
    green: Math.exp(-airMass * rayleighOpticalDepth(RGB_WAVELENGTHS_UM.green)),
    blue: Math.exp(-airMass * rayleighOpticalDepth(RGB_WAVELENGTHS_UM.blue)),
  };
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(value, 1));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

export function rayleighStyleForAirMass(relativeAirMass: number): RayleighRayStyle {
  const finiteAirMass = Number.isFinite(relativeAirMass)
    ? Math.max(0, relativeAirMass)
    : MAX_VISUAL_AIR_MASS;
  const transmission = rayleighTransmissionRgb(finiteAirMass);
  const peak = Math.max(transmission.red, transmission.green, transmission.blue, 1e-8);
  const chromaticity = {
    red: transmission.red / peak,
    green: transmission.green / peak,
    blue: transmission.blue / peak,
  };
  const red = Math.round(linearToSrgb(chromaticity.red) * 255);
  const green = Math.round(linearToSrgb(chromaticity.green) * 255);
  const blue = Math.round(linearToSrgb(chromaticity.blue) * 255);

  // Preserve the physical chromaticity while compressing brightness into a UI-safe opacity.
  // A strict Beer–Lambert rendering would make grazing rays effectively disappear.
  const luminance =
    0.2126 * transmission.red + 0.7152 * transmission.green + 0.0722 * transmission.blue;
  const alpha = Math.min(0.96, Math.max(0.58, 0.5 + 0.46 * luminance ** 0.25));

  return {
    airMass: finiteAirMass,
    linearTransmission: transmission,
    cssColor: `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`,
  };
}

export function rayleighStyleForRay(
  baseAltitudeKm: number,
  sunAltitudeDeg: number,
): RayleighRayStyle {
  return rayleighStyleForAirMass(sphericalRayAirMass(baseAltitudeKm, sunAltitudeDeg));
}
