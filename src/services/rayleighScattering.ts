import { EARTH_RADIUS_KM } from './sunRayGeometry';

// A compact model for colouring the direct solar beam. The base helpers model molecular
// (Rayleigh) extinction; the rendered-beam path also applies an AOD-driven aerosol layer. Ozone,
// refraction, terrain and multiple scattering are not included. Spherical path integration remains
// valid across the drawer's +2°..−6° range, where plane-parallel air-mass approximations fail.

const ATMOSPHERE_SCALE_HEIGHT_KM = 8.4;
const ATMOSPHERE_TOP_KM = 100;
const INTEGRATION_STEP_KM = 2;
const MAX_PATH_KM = 4000;
const MAX_VISUAL_AIR_MASS = 120;
const AEROSOL_SCALE_HEIGHT_KM = 1.5;
const AEROSOL_TOP_KM = 30;
const AEROSOL_INTEGRATION_STEP_KM = 0.5;
const AEROSOL_MAX_PATH_KM = 2000;
const MAX_AEROSOL_AIR_MASS = 1000;
const AEROSOL_REFERENCE_WAVELENGTH_UM = 0.55;
const DEFAULT_ANGSTROM_EXPONENT = 1.3;
const EXTRATERRESTRIAL_SOLAR_ILLUMINANCE_LUX = 133_000;
// Rendering floor only, not a physical cloud-visibility threshold. Actual visibility also depends
// on cloud reflectance, illumination angle, observer path and contrast against the twilight sky.
const MIN_RENDERED_DIRECT_ILLUMINANCE_LUX = 0.01;

/** Climatological fallback used only when the selected forecast hour has no AOD value. */
export const DEFAULT_AEROSOL_OPTICAL_DEPTH = 0.1;

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

export interface DirectSunlightRayStyle extends RayleighRayStyle {
  aerosolAirMass: number;
  luminousTransmission: number;
  directNormalIlluminanceLux: number;
  visible: boolean;
}

function atmosphericDensity(
  relativeAltitudeKm: number,
  scaleHeightKm: number,
  atmosphereTopKm: number,
): number {
  if (relativeAltitudeKm <= 0) return 1;
  if (relativeAltitudeKm >= atmosphereTopKm) return 0;
  return Math.exp(-relativeAltitudeKm / scaleHeightKm);
}

function radialAltitudeKm(xKm: number, tangentPlaneAltitudeKm: number): number {
  return Math.hypot(xKm, EARTH_RADIUS_KM + tangentPlaneAltitudeKm) - EARTH_RADIUS_KM;
}

function sphericalAirMass(
  baseAltitudeKm: number,
  sunAltitudeDeg: number,
  scaleHeightKm: number,
  atmosphereTopKm: number,
  integrationStepKm: number,
  maxPathKm: number,
): number {
  if (!Number.isFinite(baseAltitudeKm) || !Number.isFinite(sunAltitudeDeg)) return 1;

  const angleRad = (sunAltitudeDeg * Math.PI) / 180;
  const directionX = Math.cos(angleRad);
  const directionY = Math.sin(angleRad);
  let previousAltitude = radialAltitudeKm(0, baseAltitudeKm);
  if (previousAltitude < 0) return Infinity;
  let previousDensity = atmosphericDensity(previousAltitude, scaleHeightKm, atmosphereTopKm);
  let integratedDensityKm = 0;
  let exitedAtmosphere = previousAltitude >= atmosphereTopKm && directionY >= 0;

  for (
    let sKm = integrationStepKm;
    !exitedAtmosphere && sKm <= maxPathKm;
    sKm += integrationStepKm
  ) {
    const xKm = sKm * directionX;
    const yKm = baseAltitudeKm + sKm * directionY;
    const altitudeKm = radialAltitudeKm(xKm, yKm);
    if (altitudeKm < -1e-6) return Infinity;

    const density = atmosphericDensity(altitudeKm, scaleHeightKm, atmosphereTopKm);
    integratedDensityKm += ((previousDensity + density) * integrationStepKm) / 2;
    exitedAtmosphere = altitudeKm >= atmosphereTopKm && altitudeKm > previousAltitude;
    previousAltitude = altitudeKm;
    previousDensity = density;
  }

  const verticalColumnKm = scaleHeightKm * (1 - Math.exp(-atmosphereTopKm / scaleHeightKm));
  return integratedDensityKm / verticalColumnKm;
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
  return sphericalAirMass(
    baseAltitudeKm,
    sunAltitudeDeg,
    ATMOSPHERE_SCALE_HEIGHT_KM,
    ATMOSPHERE_TOP_KM,
    INTEGRATION_STEP_KM,
    MAX_PATH_KM,
  );
}

/** Relative slant air mass for a near-surface aerosol layer with a 1.5 km scale height. */
export function sphericalAerosolAirMass(baseAltitudeKm: number, sunAltitudeDeg: number): number {
  return sphericalAirMass(
    baseAltitudeKm,
    sunAltitudeDeg,
    AEROSOL_SCALE_HEIGHT_KM,
    AEROSOL_TOP_KM,
    AEROSOL_INTEGRATION_STEP_KM,
    AEROSOL_MAX_PATH_KM,
  );
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

function aerosolOpticalDepth(aerosolOpticalDepth550nm: number, wavelengthUm: number): number {
  const aod = Math.max(0, aerosolOpticalDepth550nm);
  return aod * (AEROSOL_REFERENCE_WAVELENGTH_UM / wavelengthUm) ** DEFAULT_ANGSTROM_EXPONENT;
}

function directTransmissionRgb(
  rayleighAirMass: number,
  aerosolAirMass: number,
  aerosolOpticalDepth550nm: number,
): LinearRgb {
  const molecularMass = Number.isFinite(rayleighAirMass)
    ? Math.max(0, rayleighAirMass)
    : MAX_VISUAL_AIR_MASS;
  const particleMass = Number.isFinite(aerosolAirMass)
    ? Math.max(0, aerosolAirMass)
    : MAX_AEROSOL_AIR_MASS;
  const transmissionAt = (wavelengthUm: number) =>
    Math.exp(
      -molecularMass * rayleighOpticalDepth(wavelengthUm) -
        particleMass * aerosolOpticalDepth(aerosolOpticalDepth550nm, wavelengthUm),
    );

  return {
    red: transmissionAt(RGB_WAVELENGTHS_UM.red),
    green: transmissionAt(RGB_WAVELENGTHS_UM.green),
    blue: transmissionAt(RGB_WAVELENGTHS_UM.blue),
  };
}

/**
 * Style a direct solar beam using both molecular extinction and the selected hour's AOD.
 *
 * Geometry alone only says that a ray clears the Earth. A grazing ray can still have effectively
 * zero transmission after crossing hundreds of kilometres of dense lower atmosphere. Opacity is
 * based on absolute direct-normal illuminance from the 133 klx extraterrestrial Sun, on a
 * logarithmic display scale. The low cutoff is only a rendering floor, not a claim that a cloud
 * below it could never be observed.
 */
export function directSunlightStyleForRay(
  baseAltitudeKm: number,
  sunAltitudeDeg: number,
  aerosolOpticalDepth550nm: number = DEFAULT_AEROSOL_OPTICAL_DEPTH,
): DirectSunlightRayStyle {
  const airMass = sphericalRayAirMass(baseAltitudeKm, sunAltitudeDeg);
  const aerosolAirMass = sphericalAerosolAirMass(baseAltitudeKm, sunAltitudeDeg);
  const transmission = directTransmissionRgb(airMass, aerosolAirMass, aerosolOpticalDepth550nm);
  const luminousTransmission =
    0.2126 * transmission.red + 0.7152 * transmission.green + 0.0722 * transmission.blue;
  const directNormalIlluminanceLux = EXTRATERRESTRIAL_SOLAR_ILLUMINANCE_LUX * luminousTransmission;
  const visible = directNormalIlluminanceLux >= MIN_RENDERED_DIRECT_ILLUMINANCE_LUX;
  const peak = Math.max(transmission.red, transmission.green, transmission.blue, 1e-8);
  const red = Math.round(linearToSrgb(transmission.red / peak) * 255);
  const green = Math.round(linearToSrgb(transmission.green / peak) * 255);
  const blue = Math.round(linearToSrgb(transmission.blue / peak) * 255);
  const displayRange = Math.log10(
    EXTRATERRESTRIAL_SOLAR_ILLUMINANCE_LUX / MIN_RENDERED_DIRECT_ILLUMINANCE_LUX,
  );
  const visibility =
    Math.log10(
      Math.max(directNormalIlluminanceLux, MIN_RENDERED_DIRECT_ILLUMINANCE_LUX) /
        MIN_RENDERED_DIRECT_ILLUMINANCE_LUX,
    ) / displayRange;
  const alpha = visible ? Math.min(0.96, 0.06 + 0.9 * visibility ** 0.75) : 0;

  return {
    airMass: Number.isFinite(airMass) ? Math.max(0, airMass) : MAX_VISUAL_AIR_MASS,
    aerosolAirMass: Number.isFinite(aerosolAirMass)
      ? Math.max(0, aerosolAirMass)
      : MAX_AEROSOL_AIR_MASS,
    linearTransmission: transmission,
    luminousTransmission,
    directNormalIlluminanceLux,
    visible,
    cssColor: `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`,
  };
}
