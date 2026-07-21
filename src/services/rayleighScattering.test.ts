import { describe, expect, it } from 'vitest';
import { earthShadowBoundaryKm } from './sunRayGeometry';
import {
  rayleighOpticalDepth,
  rayleighStyleForAirMass,
  rayleighStyleForRay,
  rayleighTransmissionRgb,
  sphericalRayAirMass,
} from './rayleighScattering';

describe('rayleighScattering', () => {
  it('attenuates blue wavelengths more strongly than red wavelengths', () => {
    expect(rayleighOpticalDepth(0.45)).toBeGreaterThan(rayleighOpticalDepth(0.55));
    expect(rayleighOpticalDepth(0.55)).toBeGreaterThan(rayleighOpticalDepth(0.65));

    const transmitted = rayleighTransmissionRgb(10);
    expect(transmitted.red).toBeGreaterThan(transmitted.green);
    expect(transmitted.green).toBeGreaterThan(transmitted.blue);
  });

  it('matches the expected vertical and horizon-scale optical air masses', () => {
    expect(sphericalRayAirMass(0, 90)).toBeCloseTo(1, 1);
    expect(sphericalRayAirMass(0, 0)).toBeGreaterThan(30);
    expect(sphericalRayAirMass(0, 0)).toBeLessThan(45);
  });

  it('makes a grazing twilight ray redder than a higher parallel ray', () => {
    const sunAltitudeDeg = -3;
    const grazingBaseKm = earthShadowBoundaryKm(sunAltitudeDeg);
    const grazing = rayleighStyleForRay(grazingBaseKm, sunAltitudeDeg);
    const high = rayleighStyleForRay(grazingBaseKm + 10, sunAltitudeDeg);

    const grazingBlueRatio = grazing.linearTransmission.blue / grazing.linearTransmission.red;
    const highBlueRatio = high.linearTransmission.blue / high.linearTransmission.red;
    expect(grazing.airMass).toBeGreaterThan(high.airMass);
    expect(grazingBlueRatio).toBeLessThan(highBlueRatio);
  });

  it('keeps highly attenuated rays visible while preserving their red chromaticity', () => {
    const style = rayleighStyleForAirMass(80);
    const channels = style.cssColor.match(/[\d.]+/g)?.map(Number) ?? [];
    expect(channels[0]).toBe(255);
    expect(channels[1]).toBeLessThan(80);
    expect(channels[2]).toBeLessThan(10);
    expect(channels[3]).toBeGreaterThanOrEqual(0.58);
  });
});
