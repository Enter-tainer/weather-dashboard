import { parseRoute } from './urlParser';
import { cachedFetch, TTL_WEATHER } from './cache';
import { getCityDetails, reverseGeocode } from './geocoding';
import { SOUNDING_PRESSURE_LEVELS, dewPointFromRh } from './sounding';
import * as SunCalc from 'suncalc';
import type {
  MoonEvent,
  MoonEventList,
  NightBand,
  RouteEntry,
  SunEvent,
  WeatherDataSource,
  WeatherPoint,
  WeatherTimeline,
} from '../types/weather';

type HourlySeries = Array<number | string | null>;

interface OpenMeteoHourly {
  time: string[];
  [key: string]: HourlySeries | undefined;
}

interface OpenMeteoResponse {
  error?: boolean;
  hourly?: OpenMeteoHourly;
  utc_offset_seconds?: number;
  timezone?: string;
  elevation?: number;
}

interface TimelineUpdateInfo {
  done: boolean;
  loaded: number;
  total: number;
}

type TimelineUpdateHandler = (timeline: WeatherTimeline, info: TimelineUpdateInfo) => void;

type IndexedSunEvent = SunEvent & { absoluteIndex: number };

// Compute a percentile from a sorted array using linear interpolation.
// p is in 0..100 (e.g., 10 for P10, 50 for median).
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const k = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  const lower = sorted[lo];
  const upper = sorted[hi];
  if (lower == null || upper == null) return null;
  if (lo === hi) return lower;
  return lower + (k - lo) * (upper - lower);
}

// Estimate visibility (meters) from pollutant concentrations and relative humidity.
// Uses Koschmieder equation: V = 3912 / β_total (km)
// β components in 1/Mm (inverse megameters):
//   fine scatter: 3.0 * PM2.5 * f(RH)
//   coarse scatter: 0.6 * max(PM10 - PM2.5, 0)
//   NO2 absorption: 0.33 * NO2
//   Rayleigh (clean air): 10
// f(RH) = hygroscopic growth ≈ (1 - RH/100)^-0.55, capped at RH=95%
function estimateVisibility(
  pm25: number | null | undefined,
  pm10: number | null | undefined,
  no2: number | null | undefined,
  rh: number | null | undefined,
): number | null {
  if (pm25 == null && pm10 == null) return null;
  const fRH = rh == null ? 1 : Math.pow(1 - Math.min(rh, 95) / 100, -0.55);
  const bFine = 3.0 * (pm25 || 0) * fRH;
  const bCoarse = 0.6 * Math.max((pm10 || 0) - (pm25 || 0), 0);
  const bNO2 = 0.33 * (no2 || 0);
  const bRayleigh = 10;
  const bTotal = bFine + bCoarse + bNO2 + bRayleigh;
  return (3912 / bTotal) * 1000; // km → meters
}

// Memoize processed results to avoid re-running SunCalc + member extraction.
// The display name is part of the key because processed rows include cityName.
const processedCache = new Map<string, WeatherTimeline>();

function nullableArray(length: number): Array<number | null> {
  return new Array<number | null>(length).fill(null);
}

function nullableNumberAt(series: HourlySeries | undefined, index: number): number | null {
  const value = series?.[index];
  return typeof value === 'number' ? value : null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function memberValues(hourly: OpenMeteoHourly, memberPrefix: string, index: number): number[] {
  const values: number[] = [];
  for (const [key, arr] of Object.entries(hourly)) {
    if (!key.startsWith(memberPrefix)) continue;
    const value = nullableNumberAt(arr, index);
    if (value != null) values.push(value);
  }
  return values;
}

function circularMeanDegrees(values: number[]): number | null {
  if (values.length === 0) return null;

  let sinSum = 0;
  let cosSum = 0;
  for (const value of values) {
    const radians = (value * Math.PI) / 180;
    sinSum += Math.sin(radians);
    cosSum += Math.cos(radians);
  }

  if (Math.hypot(sinSum, cosSum) < 1e-9) return null;
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
}

function modalRounded(values: number[]): number | null {
  if (values.length === 0) return null;

  const frequencies = new Map<number, number>();
  for (const value of values) {
    const rounded = Math.round(value);
    frequencies.set(rounded, (frequencies.get(rounded) ?? 0) + 1);
  }

  return [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

function precipitationProbabilityFromMembers(values: number[]): number | null {
  if (values.length === 0) return null;
  const wetMembers = values.filter((value) => value > 0.1).length;
  return Math.round((wetMembers / values.length) * 100);
}

function minNullable(...values: Array<number | null>): number | null {
  const valid = values.filter(isFiniteNumber);
  return valid.length > 0 ? Math.min(...valid) : null;
}

export async function fetchCityDataForDate(cityObj: RouteEntry): Promise<WeatherTimeline> {
  const { city, date, originalName, lat, lon } = cityObj;
  const memoKey =
    lat != null
      ? `${lat},${lon}:${date}:${originalName || ''}`
      : `${city}:${date}:${originalName || ''}`;
  const processed = processedCache.get(memoKey);
  if (processed) return processed;

  let latitude: number;
  let longitude: number;
  let timezone: string;
  let name: string;
  if (lat != null && lon != null) {
    latitude = lat;
    longitude = lon;
    timezone = 'auto';
    name = originalName || (await reverseGeocode(lat, lon, `${lat}°, ${lon}°`));
  } else {
    ({ latitude, longitude, timezone, name } = await getCityDetails(city ?? 'Beijing'));
  }

  const tzParams = `&timezone=${encodeURIComponent(timezone)}&start_date=${date}&end_date=${date}`;

  // 1. 根据日期差动态选择最精确的集合模型
  const targetDate = new Date(date);
  const now = new Date();
  const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let ensembleModel = 'gfs05'; // fallback for > 15 days (up to 35 days, 31 members, 50km)
  if (diffDays <= 15) {
    // 15天内用 ecmwf_ifs025，精度最高(51 members, 25km)
    ensembleModel = 'ecmwf_ifs025';
  }

  // Pressure levels for altitude-based cloud visualization
  const pressureLevels = SOUNDING_PRESSURE_LEVELS;
  const cloudPressureParams = pressureLevels.map((p) => `cloud_cover_${p}hPa`).join(',');
  const geopotentialParams = pressureLevels.map((p) => `geopotential_height_${p}hPa`).join(',');
  const soundingParams = [
    ...pressureLevels.map((p) => `temperature_${p}hPa`),
    ...pressureLevels.map((p) => `dew_point_${p}hPa`),
    ...pressureLevels.map((p) => `relative_humidity_${p}hPa`),
    ...pressureLevels.map((p) => `wind_speed_${p}hPa`),
    ...pressureLevels.map((p) => `wind_direction_${p}hPa`),
  ].join(',');

  // Forecast API
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,uv_index,surface_pressure,cape,boundary_layer_height,${cloudPressureParams},${geopotentialParams},${soundingParams}${tzParams}`;

  // Ensemble API
  const ensembleUrl = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,surface_pressure,weather_code&models=${ensembleModel}${tzParams}`;

  // AQI API
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,dust,aerosol_optical_depth${tzParams}`;

  const [initialForecastRes, ensembleRes, aqRes] = await Promise.all([
    cachedFetch<OpenMeteoResponse>(forecastUrl, TTL_WEATHER).catch(() => null),
    cachedFetch<OpenMeteoResponse>(ensembleUrl, TTL_WEATHER).catch(() => null),
    cachedFetch<OpenMeteoResponse>(aqUrl, TTL_WEATHER).catch(() => null),
  ]);
  let forecastRes = initialForecastRes;
  let forecastDataSource: WeatherDataSource = 'forecast';

  // 2. 如果常规预报由于超期（>16天）无法拿到，或返回了 error，则使用 Ensemble 数据替代主线
  if (!forecastRes || forecastRes.error || !forecastRes.hourly) {
    if (!ensembleRes || ensembleRes.error || !ensembleRes.hourly) {
      throw new Error(`Failed to fetch both forecast and ensemble for ${name}`);
    }

    const hoursCount = ensembleRes.hourly.time.length;
    const temperature2m = nullableArray(hoursCount);
    const relativeHumidity2m = nullableArray(hoursCount);
    const dewPoint2m = nullableArray(hoursCount);
    const precipitation = nullableArray(hoursCount);
    const precipitationProbability = nullableArray(hoursCount);
    const windSpeed10m = nullableArray(hoursCount);
    const apparentTemperature = nullableArray(hoursCount);
    const weatherCode = nullableArray(hoursCount);
    const windDirection10m = nullableArray(hoursCount);
    const windGusts10m = nullableArray(hoursCount);
    const visibility = nullableArray(hoursCount);
    const cloudCover = nullableArray(hoursCount);
    const cloudCoverLow = nullableArray(hoursCount);
    const cloudCoverMid = nullableArray(hoursCount);
    const cloudCoverHigh = nullableArray(hoursCount);
    const uvIndex = nullableArray(hoursCount);
    const surfacePressure = nullableArray(hoursCount);
    const cape = nullableArray(hoursCount);

    const mockHourly: OpenMeteoHourly = {
      time: ensembleRes.hourly.time,
      temperature_2m: temperature2m,
      relative_humidity_2m: relativeHumidity2m,
      dew_point_2m: dewPoint2m,
      precipitation,
      precipitation_probability: precipitationProbability,
      wind_speed_10m: windSpeed10m,
      apparent_temperature: apparentTemperature,
      weather_code: weatherCode,
      wind_direction_10m: windDirection10m,
      wind_gusts_10m: windGusts10m,
      visibility,
      cloud_cover: cloudCover,
      cloud_cover_low: cloudCoverLow,
      cloud_cover_mid: cloudCoverMid,
      cloud_cover_high: cloudCoverHigh,
      uv_index: uvIndex,
      surface_pressure: surfacePressure,
      cape,
    };

    // Calculate representative values from ensemble members. Fields without
    // ensemble support stay null so the UI can render them as unavailable.
    for (let i = 0; i < hoursCount; i++) {
      const tempMembers = memberValues(ensembleRes.hourly, 'temperature_2m_member', i);
      const humidityMembers = memberValues(ensembleRes.hourly, 'relative_humidity_2m_member', i);
      const precipMembers = memberValues(ensembleRes.hourly, 'precipitation_member', i);
      const windMembers = memberValues(ensembleRes.hourly, 'wind_speed_10m_member', i);
      const windDirMembers = memberValues(ensembleRes.hourly, 'wind_direction_10m_member', i);
      const cloudMembers = memberValues(ensembleRes.hourly, 'cloud_cover_member', i);
      const pressureMembers = memberValues(ensembleRes.hourly, 'surface_pressure_member', i);
      const weatherCodeMembers = memberValues(ensembleRes.hourly, 'weather_code_member', i);

      const meanTemp = mean(tempMembers);
      const meanHumidity = mean(humidityMembers);
      const meanPrecip = mean(precipMembers);
      const meanWind = mean(windMembers);

      temperature2m[i] = meanTemp;
      relativeHumidity2m[i] = meanHumidity;
      dewPoint2m[i] =
        meanTemp != null && meanHumidity != null ? dewPointFromRh(meanTemp, meanHumidity) : null;
      precipitation[i] = meanPrecip;
      precipitationProbability[i] = precipitationProbabilityFromMembers(precipMembers);
      windSpeed10m[i] = meanWind;
      windDirection10m[i] = circularMeanDegrees(windDirMembers);
      cloudCover[i] = mean(cloudMembers);
      surfacePressure[i] = mean(pressureMembers);
      weatherCode[i] = modalRounded(weatherCodeMembers);
    }

    forecastRes = { ...ensembleRes, hourly: mockHourly };
    forecastDataSource = 'ensemble';
  }

  // Use utc_offset_seconds from API response for reliable timezone handling.
  // API returns local times without offset; JS Date parses them as browser-local.
  // driftMs = target_offset - browser_offset (the gap between the two).
  const targetOffsetMs =
    (forecastRes?.utc_offset_seconds ?? ensembleRes?.utc_offset_seconds ?? 0) * 1000;
  const browserOffsetMs = -new Date(date + 'T12:00:00').getTimezoneOffset() * 60000;
  const driftMs = targetOffsetMs - browserOffsetMs;
  const toUtc = (localStr: string) => new Date(new Date(localStr).getTime() - driftMs);
  const fromUtc = (utcDate: Date) => new Date(utcDate.getTime() + driftMs);

  // Resolve the IANA timezone name for toLocaleString (handles timezone='auto')
  const resolvedTz = forecastRes?.timezone || ensembleRes?.timezone || timezone;
  const localTime = (utcDate: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolvedTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(utcDate);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    return { localHour: h, localMinute: m };
  };

  const forecastHourly = forecastRes.hourly;
  if (!forecastHourly) {
    throw new Error(`Forecast hourly data missing for ${name}`);
  }

  const hoursCount = forecastHourly.time.length;
  const elevation = forecastRes?.elevation ?? ensembleRes?.elevation ?? 0;
  const combined: WeatherTimeline = [];

  for (let i = 0; i < hoursCount; i++) {
    const time = forecastHourly.time[i];
    if (!time) continue;

    const tempMembers: number[] = [];
    const precipMembers: number[] = [];
    const windMembers: number[] = [];
    const cloudMembers: number[] = [];
    const pressureMembers: number[] = [];
    const weatherCodeMembers: number[] = [];
    if (ensembleRes && ensembleRes.hourly) {
      for (const key in ensembleRes.hourly) {
        const value = nullableNumberAt(ensembleRes.hourly[key], i);
        if (key.startsWith('temperature_2m_member') && value != null) tempMembers.push(value);
        if (key.startsWith('precipitation_member') && value != null) precipMembers.push(value);
        if (key.startsWith('wind_speed_10m_member') && value != null) windMembers.push(value);
        if (key.startsWith('cloud_cover_member') && value != null) cloudMembers.push(value);
        if (key.startsWith('surface_pressure_member') && value != null) pressureMembers.push(value);
        if (key.startsWith('weather_code_member') && value != null) weatherCodeMembers.push(value);
      }
    }

    // Compute ensemble percentiles for temperature (sorted members)
    tempMembers.sort((a, b) => a - b);
    const tempEnsemble = {
      p10: percentile(tempMembers, 10),
      p25: percentile(tempMembers, 25),
      p50: percentile(tempMembers, 50),
      p75: percentile(tempMembers, 75),
      p90: percentile(tempMembers, 90),
    };

    const cloudByLevel = pressureLevels.map((p) => ({
      pressure: p,
      cover: nullableNumberAt(forecastHourly[`cloud_cover_${p}hPa`], i),
      altitude: nullableNumberAt(forecastHourly[`geopotential_height_${p}hPa`], i),
    }));
    const hasCloudByLevelData = cloudByLevel.some(
      (level) => level.cover != null || level.altitude != null,
    );

    combined.push({
      cityName: originalName || name,
      latitude,
      longitude,
      time,
      timeUtcMs: toUtc(time).getTime(),
      timezone: resolvedTz,
      utcOffsetSeconds: targetOffsetMs / 1000,
      hour: new Date(time).getHours(),

      weatherCode: nullableNumberAt(forecastHourly.weather_code, i),
      temperature: nullableNumberAt(forecastHourly.temperature_2m, i),
      humidity: nullableNumberAt(forecastHourly.relative_humidity_2m, i),
      dewPoint: nullableNumberAt(forecastHourly.dew_point_2m, i),
      apparentTemp: nullableNumberAt(forecastHourly.apparent_temperature, i),
      precipitation: nullableNumberAt(forecastHourly.precipitation, i),
      precipitationProb: nullableNumberAt(forecastHourly.precipitation_probability, i),
      precipitationInterval: 'preceding-hour',
      windSpeed: nullableNumberAt(forecastHourly.wind_speed_10m, i),
      windGusts: nullableNumberAt(forecastHourly.wind_gusts_10m, i),
      windDir: nullableNumberAt(forecastHourly.wind_direction_10m, i),
      visibility: minNullable(
        nullableNumberAt(forecastHourly.visibility, i),
        estimateVisibility(
          nullableNumberAt(aqRes?.hourly?.pm2_5, i),
          nullableNumberAt(aqRes?.hourly?.pm10, i),
          nullableNumberAt(aqRes?.hourly?.nitrogen_dioxide, i),
          nullableNumberAt(forecastHourly.relative_humidity_2m, i),
        ),
      ),

      uvIndex: nullableNumberAt(forecastHourly.uv_index, i),
      pressure: nullableNumberAt(forecastHourly.surface_pressure, i),
      cape: nullableNumberAt(forecastHourly.cape, i),

      cloudCover: nullableNumberAt(forecastHourly.cloud_cover, i),
      cloudLow: nullableNumberAt(forecastHourly.cloud_cover_low, i),
      cloudMid: nullableNumberAt(forecastHourly.cloud_cover_mid, i),
      cloudHigh: nullableNumberAt(forecastHourly.cloud_cover_high, i),

      boundaryLayerHeight: nullableNumberAt(forecastHourly.boundary_layer_height, i),

      // Pressure-level cloud cover and geopotential heights for altitude visualization
      cloudByLevel: hasCloudByLevelData ? cloudByLevel : undefined,

      soundingLevels: pressureLevels
        .map((p) => {
          const temp = nullableNumberAt(forecastHourly[`temperature_${p}hPa`], i);
          const rh = nullableNumberAt(forecastHourly[`relative_humidity_${p}hPa`], i);
          const dewPoint =
            nullableNumberAt(forecastHourly[`dew_point_${p}hPa`], i) ?? dewPointFromRh(temp, rh);
          const altitude = nullableNumberAt(forecastHourly[`geopotential_height_${p}hPa`], i);

          return {
            pressure: p,
            temp,
            dewPoint,
            relativeHumidity: rh,
            altitude,
            agl: altitude != null ? Math.max(0, altitude - elevation) : null,
            windSpeed: nullableNumberAt(forecastHourly[`wind_speed_${p}hPa`], i),
            windDir: nullableNumberAt(forecastHourly[`wind_direction_${p}hPa`], i),
          };
        })
        .filter((level) => level.temp != null),

      tempMembers,
      tempEnsemble,
      precipMembers,
      windMembers,
      cloudMembers,
      pressureMembers,
      weatherCodeMembers,

      aqiUS: nullableNumberAt(aqRes?.hourly?.us_aqi, i),
      aqiEU: nullableNumberAt(aqRes?.hourly?.european_aqi, i),
      pm25: nullableNumberAt(aqRes?.hourly?.pm2_5, i),
      pm10: nullableNumberAt(aqRes?.hourly?.pm10, i),
      co: nullableNumberAt(aqRes?.hourly?.carbon_monoxide, i),
      no2: nullableNumberAt(aqRes?.hourly?.nitrogen_dioxide, i),
      so2: nullableNumberAt(aqRes?.hourly?.sulphur_dioxide, i),
      dust: nullableNumberAt(aqRes?.hourly?.dust, i),
      aod: nullableNumberAt(aqRes?.hourly?.aerosol_optical_depth, i),
      dataSource: forecastDataSource,
    });
  }

  // Sun, moon & twilight events via SunCalc
  const dateObj = toUtc(date + 'T12:00:00');
  const sunTimes = SunCalc.getTimes(dateObj, latitude, longitude);

  const sunEvents: SunEvent[] = [];
  if (sunTimes.sunrise)
    sunEvents.push({
      type: 'sunrise',
      time: fromUtc(sunTimes.sunrise),
      ...localTime(sunTimes.sunrise),
    });
  if (sunTimes.sunset)
    sunEvents.push({
      type: 'sunset',
      time: fromUtc(sunTimes.sunset),
      ...localTime(sunTimes.sunset),
    });

  // Compute sun altitude for each hour (for twilight gradient lane)
  for (const item of combined) {
    const pos = SunCalc.getPosition(toUtc(item.time), latitude, longitude);
    item.sunAltitude = pos.altitude; // v2: apparent altitude in degrees (refraction-corrected)
  }

  const moonEvents: MoonEventList = [];
  const moonTimes = SunCalc.getMoonTimes(dateObj, latitude, longitude);
  const moonIllum = SunCalc.getMoonIllumination(dateObj);
  if (moonTimes.rise)
    moonEvents.push({
      type: 'moonrise',
      time: fromUtc(moonTimes.rise),
      ...localTime(moonTimes.rise),
      phase: moonIllum.phase,
      fraction: moonIllum.fraction,
    });
  if (moonTimes.set)
    moonEvents.push({
      type: 'moonset',
      time: fromUtc(moonTimes.set),
      ...localTime(moonTimes.set),
      phase: moonIllum.phase,
      fraction: moonIllum.fraction,
    });

  // Add moon phase + fraction to each hourly data point
  for (const item of combined) {
    const illum = SunCalc.getMoonIllumination(toUtc(item.time));
    item.moonPhase = illum.phase;
    item.moonFraction = illum.fraction;
  }

  combined.sunEvents = sunEvents;
  combined.moonEvents = moonEvents;
  processedCache.set(memoKey, combined);
  return combined;
}

export function assembleTimeline(results: WeatherTimeline[]): WeatherTimeline {
  const flatData: WeatherTimeline = [];
  const globalSunEvents: SunEvent[] = [];
  const globalNightBands: NightBand[] = [];
  const globalMoonEvents: MoonEventList = [];

  let currentOffset = 0;
  for (const res of results) {
    if (!res || res.length === 0) continue;
    flatData.push(...res);

    const firstItem = res[0];
    if (!firstItem) continue;

    if (res.sunEvents) {
      const cityStartTimeMs = new Date(firstItem.time).getTime();
      const validSunEvents: IndexedSunEvent[] = [];

      res.sunEvents.forEach((ev) => {
        const diffHours = (ev.time.getTime() - cityStartTimeMs) / 3600000;
        if (diffHours >= 0 && diffHours <= res.length) {
          const absIdx = currentOffset + diffHours;
          validSunEvents.push({ ...ev, absoluteIndex: absIdx });
          globalSunEvents.push({ ...ev, absoluteIndex: absIdx });
        }
      });

      validSunEvents.sort((a, b) => a.absoluteIndex - b.absoluteIndex);

      let currentNightStart: number | null = null;
      const firstSunEvent = validSunEvents[0];
      if (firstSunEvent && firstSunEvent.type === 'sunrise') {
        currentNightStart = currentOffset;
      }

      validSunEvents.forEach((ev) => {
        if (ev.type === 'sunrise') {
          if (currentNightStart !== null) {
            globalNightBands.push({ left: currentNightStart, right: ev.absoluteIndex });
            currentNightStart = null;
          }
        } else if (ev.type === 'sunset') {
          currentNightStart = ev.absoluteIndex;
        }
      });

      if (currentNightStart !== null) {
        globalNightBands.push({ left: currentNightStart, right: currentOffset + res.length });
      }
    }

    if (res.moonEvents) {
      const cityStartTimeMs = new Date(firstItem.time).getTime();
      res.moonEvents.forEach((ev) => {
        const diffHours = (ev.time.getTime() - cityStartTimeMs) / 3600000;
        if (diffHours >= 0 && diffHours <= res.length) {
          globalMoonEvents.push({ ...ev, absoluteIndex: currentOffset + diffHours });
        }
      });
      // Attach phase info to the city's range
      if (globalMoonEvents.phase == null && res.moonEvents.phase != null) {
        globalMoonEvents.phase = res.moonEvents.phase;
      }
      if (globalMoonEvents.fraction == null && res.moonEvents.fraction != null) {
        globalMoonEvents.fraction = res.moonEvents.fraction;
      }
    }

    currentOffset += res.length;
  }

  flatData.sunEvents = globalSunEvents;
  flatData.nightBands = globalNightBands;
  flatData.moonEvents = globalMoonEvents;

  return flatData;
}

async function fetchAndAssemble(route: RouteEntry[]): Promise<WeatherTimeline> {
  const results = await Promise.all(
    route.map((cityObj) =>
      fetchCityDataForDate(cityObj).catch((e: unknown) => {
        console.error(e);
        const empty: WeatherTimeline = [];
        return empty;
      }),
    ),
  );
  return assembleTimeline(results);
}

// Streaming variant: calls onUpdate(timeline, {done, loaded, total}) as each city resolves
export function fetchAndAssembleStreaming(
  route: RouteEntry[],
  onUpdate: TimelineUpdateHandler,
): void {
  const results = Array.from({ length: route.length }, (): WeatherTimeline | null => null);
  let loaded = 0;
  const total = route.length;

  route.forEach((cityObj, idx) => {
    void fetchCityDataForDate(cityObj)
      .catch((e: unknown) => {
        console.error(e);
        const empty: WeatherTimeline = [];
        return empty;
      })
      .then((cityData) => {
        results[idx] = cityData;
        loaded++;
        const timeline = assembleTimeline(
          results.map((r) => {
            if (r) return r;
            const empty: WeatherTimeline = [];
            return empty;
          }),
        );
        onUpdate(timeline, { done: loaded === total, loaded, total });
      });
  });
}

export async function fetchFullTimeline(): Promise<WeatherTimeline> {
  const route = await parseRoute();
  return fetchAndAssemble(route);
}

export function fetchFullTimelineStreaming(onUpdate: TimelineUpdateHandler): void {
  void parseRoute()
    .then((route) => {
      fetchAndAssembleStreaming(route, onUpdate);
    })
    .catch((error: unknown) => {
      console.error(error);
      const empty: WeatherTimeline = [];
      onUpdate(empty, { done: true, loaded: 0, total: 0 });
    });
}

export async function fetchTimelineForRoute(route: RouteEntry[]): Promise<WeatherTimeline> {
  return fetchAndAssemble(route);
}

export function fetchTimelineForRouteStreaming(
  route: RouteEntry[],
  onUpdate: TimelineUpdateHandler,
): void {
  fetchAndAssembleStreaming(route, onUpdate);
}
