import { parseRoute } from './urlParser.js';
import { cachedFetch, TTL_WEATHER } from './cache.js';
import { getCityDetails, reverseGeocode } from './geocoding.js';
import { SOUNDING_PRESSURE_LEVELS, dewPointFromRh } from './sounding.js';
import SunCalc from 'suncalc';

// Compute a percentile from a sorted array using linear interpolation.
// p is in 0..100 (e.g., 10 for P10, 50 for median).
function percentile(sorted, p) {
  if (!sorted || sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const k = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (k - lo) * (sorted[hi] - sorted[lo]);
}

// Estimate visibility (meters) from pollutant concentrations and relative humidity.
// Uses Koschmieder equation: V = 3912 / β_total (km)
// β components in 1/Mm (inverse megameters):
//   fine scatter: 3.0 * PM2.5 * f(RH)
//   coarse scatter: 0.6 * max(PM10 - PM2.5, 0)
//   NO2 absorption: 0.33 * NO2
//   Rayleigh (clean air): 10
// f(RH) = hygroscopic growth ≈ (1 - RH/100)^-0.55, capped at RH=95%
function estimateVisibility(pm25, pm10, no2, rh) {
  if (pm25 == null && pm10 == null) return null;
  const rhClamped = Math.min(rh ?? 50, 95) / 100;
  const fRH = Math.pow(1 - rhClamped, -0.55);
  const bFine = 3.0 * (pm25 || 0) * fRH;
  const bCoarse = 0.6 * Math.max((pm10 || 0) - (pm25 || 0), 0);
  const bNO2 = 0.33 * (no2 || 0);
  const bRayleigh = 10;
  const bTotal = bFine + bCoarse + bNO2 + bRayleigh;
  return (3912 / bTotal) * 1000; // km → meters
}

// Memoize processed results to avoid re-running SunCalc + member extraction.
// The display name is part of the key because processed rows include cityName.
const processedCache = new Map();

export async function fetchCityDataForDate(cityObj) {
  const { city, date, originalName, lat, lon } = cityObj;
  const memoKey = lat != null ? `${lat},${lon}:${date}:${originalName || ''}` : `${city}:${date}:${originalName || ''}`;
  if (processedCache.has(memoKey)) return processedCache.get(memoKey);
  let latitude, longitude, timezone, name;
  if (lat != null && lon != null) {
    latitude = lat;
    longitude = lon;
    timezone = 'auto';
    name = originalName || await reverseGeocode(lat, lon, `${lat}°, ${lon}°`);
  } else {
    ({ latitude, longitude, timezone, name } = await getCityDetails(city));
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
  const cloudPressureParams = pressureLevels.map(p => `cloud_cover_${p}hPa`).join(',');
  const geopotentialParams = pressureLevels.map(p => `geopotential_height_${p}hPa`).join(',');
  const soundingParams = [
    ...pressureLevels.map(p => `temperature_${p}hPa`),
    ...pressureLevels.map(p => `dew_point_${p}hPa`),
    ...pressureLevels.map(p => `relative_humidity_${p}hPa`),
    ...pressureLevels.map(p => `wind_speed_${p}hPa`),
    ...pressureLevels.map(p => `wind_direction_${p}hPa`),
  ].join(',');

  // Forecast API
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,uv_index,surface_pressure,cape,boundary_layer_height,${cloudPressureParams},${geopotentialParams},${soundingParams}${tzParams}`;

  // Ensemble API
  const ensembleUrl = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,wind_speed_10m,cloud_cover,surface_pressure,weather_code&models=${ensembleModel}${tzParams}`;

  // AQI API
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,dust,aerosol_optical_depth${tzParams}`;

  let [forecastRes, ensembleRes, aqRes] = await Promise.all([
    cachedFetch(forecastUrl, TTL_WEATHER).catch(() => null),
    cachedFetch(ensembleUrl, TTL_WEATHER).catch(() => null),
    cachedFetch(aqUrl, TTL_WEATHER).catch(() => null)
  ]);

  // 2. 如果常规预报由于超期（>16天）无法拿到，或返回了 error，则使用 Ensemble 数据替代主线
  if (!forecastRes || forecastRes.error || !forecastRes.hourly) {
    if (!ensembleRes || ensembleRes.error || !ensembleRes.hourly) {
      throw new Error(`Failed to fetch both forecast and ensemble for ${name}`);
    }
    
    const hoursCount = ensembleRes.hourly.time.length;
    const mockHourly = {
      time: ensembleRes.hourly.time,
      temperature_2m: new Array(hoursCount).fill(0),
      relative_humidity_2m: new Array(hoursCount).fill(50),
      dew_point_2m: new Array(hoursCount).fill(0),
      precipitation: new Array(hoursCount).fill(0),
      precipitation_probability: new Array(hoursCount).fill(0),
      wind_speed_10m: new Array(hoursCount).fill(0),
      apparent_temperature: new Array(hoursCount).fill(0),
      weather_code: new Array(hoursCount).fill(0),
      wind_direction_10m: new Array(hoursCount).fill(0),
      wind_gusts_10m: new Array(hoursCount).fill(0),
      visibility: new Array(hoursCount).fill(10000),
      cloud_cover: new Array(hoursCount).fill(0),
      cloud_cover_low: new Array(hoursCount).fill(0),
      cloud_cover_mid: new Array(hoursCount).fill(0),
      cloud_cover_high: new Array(hoursCount).fill(0),
      uv_index: new Array(hoursCount).fill(0),
      surface_pressure: new Array(hoursCount).fill(1013),
      cape: new Array(hoursCount).fill(0)
    };

    // Calculate mean from member data to substitute the standard forecast
    for (let i = 0; i < hoursCount; i++) {
      let tempSum = 0, precipSum = 0, windSum = 0, pressSum = 0;
      let tempCount = 0, precipCount = 0, windCount = 0, pressCount = 0;
      
      for (const [key, arr] of Object.entries(ensembleRes.hourly)) {
        if (key.startsWith('temperature_2m_member') && arr[i] != null) { tempSum += arr[i]; tempCount++; }
        if (key.startsWith('precipitation_member') && arr[i] != null) { precipSum += arr[i]; precipCount++; }
        if (key.startsWith('wind_speed_10m_member') && arr[i] != null) { windSum += arr[i]; windCount++; }
        if (key.startsWith('surface_pressure_member') && arr[i] != null) { pressSum += arr[i]; pressCount++; }
      }
      
      mockHourly.temperature_2m[i] = tempCount > 0 ? tempSum / tempCount : 0;
      mockHourly.dew_point_2m[i] = mockHourly.temperature_2m[i]; // rough fallback
      mockHourly.apparent_temperature[i] = mockHourly.temperature_2m[i]; // approximate
      mockHourly.precipitation[i] = precipCount > 0 ? precipSum / precipCount : 0;
      mockHourly.precipitation_probability[i] = mockHourly.precipitation[i] > 0.1 ? 80 : 0;
      mockHourly.wind_speed_10m[i] = windCount > 0 ? windSum / windCount : 0;
      mockHourly.wind_gusts_10m[i] = mockHourly.wind_speed_10m[i] * 1.5; // very rough estimate
      mockHourly.surface_pressure[i] = pressCount > 0 ? pressSum / pressCount : 1013;
    }
    
    forecastRes = { hourly: mockHourly };
  }

  // Use utc_offset_seconds from API response for reliable timezone handling.
  // API returns local times without offset; JS Date parses them as browser-local.
  // driftMs = target_offset - browser_offset (the gap between the two).
  const targetOffsetMs = (forecastRes?.utc_offset_seconds ?? ensembleRes?.utc_offset_seconds ?? 0) * 1000;
  const browserOffsetMs = -new Date(date + 'T12:00:00').getTimezoneOffset() * 60000;
  const driftMs = targetOffsetMs - browserOffsetMs;
  const toUtc = (localStr) => new Date(new Date(localStr).getTime() - driftMs);
  const fromUtc = (utcDate) => new Date(utcDate.getTime() + driftMs);

  // Resolve the IANA timezone name for toLocaleString (handles timezone='auto')
  const resolvedTz = forecastRes?.timezone || ensembleRes?.timezone || timezone;
  const localTime = (utcDate) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: resolvedTz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(utcDate);
    const h = parseInt(parts.find(p => p.type === 'hour').value);
    const m = parseInt(parts.find(p => p.type === 'minute').value);
    return { localHour: h, localMinute: m };
  };

  const hoursCount = forecastRes.hourly.time.length;
  const elevation = forecastRes?.elevation ?? ensembleRes?.elevation ?? 0;
  const combined = [];

  for (let i = 0; i < hoursCount; i++) {
    const tempMembers = [];
    const precipMembers = [];
    const windMembers = [];
    const cloudMembers = [];
    const pressureMembers = [];
    const weatherCodeMembers = [];
    if (ensembleRes && ensembleRes.hourly) {
      for (const key in ensembleRes.hourly) {
        if (key.startsWith('temperature_2m_member') && ensembleRes.hourly[key][i] != null) tempMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('precipitation_member') && ensembleRes.hourly[key][i] != null) precipMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('wind_speed_10m_member') && ensembleRes.hourly[key][i] != null) windMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('cloud_cover_member') && ensembleRes.hourly[key][i] != null) cloudMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('surface_pressure_member') && ensembleRes.hourly[key][i] != null) pressureMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('weather_code_member') && ensembleRes.hourly[key][i] != null) weatherCodeMembers.push(ensembleRes.hourly[key][i]);
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

    combined.push({
      cityName: originalName || name,
      time: forecastRes.hourly.time[i],
      timeUtcMs: toUtc(forecastRes.hourly.time[i]).getTime(),
      timezone: resolvedTz,
      utcOffsetSeconds: targetOffsetMs / 1000,
      hour: new Date(forecastRes.hourly.time[i]).getHours(),
      
      weatherCode: forecastRes.hourly.weather_code[i],
      temperature: forecastRes.hourly.temperature_2m[i],
      humidity: forecastRes.hourly.relative_humidity_2m[i],
      dewPoint: forecastRes.hourly.dew_point_2m[i],
      apparentTemp: forecastRes.hourly.apparent_temperature[i],
      precipitation: forecastRes.hourly.precipitation[i],
      precipitationProb: forecastRes.hourly.precipitation_probability[i],
      windSpeed: forecastRes.hourly.wind_speed_10m[i],
      windGusts: forecastRes.hourly.wind_gusts_10m[i],
      windDir: forecastRes.hourly.wind_direction_10m[i],
      visibility: Math.min(
        forecastRes.hourly.visibility[i] ?? Infinity,
        estimateVisibility(
          aqRes?.hourly?.pm2_5?.[i], aqRes?.hourly?.pm10?.[i],
          aqRes?.hourly?.nitrogen_dioxide?.[i],
          forecastRes.hourly.relative_humidity_2m[i]
        ) ?? Infinity
      ),
      
      uvIndex: forecastRes.hourly.uv_index?.[i] || 0,
      pressure: forecastRes.hourly.surface_pressure?.[i] || 1013,
      cape: forecastRes.hourly.cape?.[i] || 0,
      
      cloudCover: forecastRes.hourly.cloud_cover[i],
      cloudLow: forecastRes.hourly.cloud_cover_low[i],
      cloudMid: forecastRes.hourly.cloud_cover_mid[i],
      cloudHigh: forecastRes.hourly.cloud_cover_high[i],

      boundaryLayerHeight: forecastRes.hourly.boundary_layer_height?.[i] ?? null,

      // Pressure-level cloud cover and geopotential heights for altitude visualization
      cloudByLevel: pressureLevels.map(p => ({
        pressure: p,
        cover: forecastRes.hourly[`cloud_cover_${p}hPa`]?.[i] || 0,
        altitude: forecastRes.hourly[`geopotential_height_${p}hPa`]?.[i] || null,
      })),

      soundingLevels: pressureLevels.map(p => {
        const temp = forecastRes.hourly[`temperature_${p}hPa`]?.[i] ?? null;
        const rh = forecastRes.hourly[`relative_humidity_${p}hPa`]?.[i] ?? null;
        const dewPoint = forecastRes.hourly[`dew_point_${p}hPa`]?.[i] ?? dewPointFromRh(temp, rh);
        const altitude = forecastRes.hourly[`geopotential_height_${p}hPa`]?.[i] ?? null;

        return {
          pressure: p,
          temp,
          dewPoint,
          relativeHumidity: rh,
          altitude,
          agl: altitude != null ? Math.max(0, altitude - elevation) : null,
          windSpeed: forecastRes.hourly[`wind_speed_${p}hPa`]?.[i] ?? null,
          windDir: forecastRes.hourly[`wind_direction_${p}hPa`]?.[i] ?? null,
        };
      }).filter(level => level.temp != null),

      tempMembers,
      tempEnsemble,
      precipMembers,
      windMembers,
      cloudMembers,
      pressureMembers,
      weatherCodeMembers,

      aqiUS: aqRes?.hourly?.us_aqi?.[i] || 0,
      aqiEU: aqRes?.hourly?.european_aqi?.[i] || 0,
      pm25: aqRes?.hourly?.pm2_5?.[i] || 0,
      pm10: aqRes?.hourly?.pm10?.[i] || 0,
      co: aqRes?.hourly?.carbon_monoxide?.[i] || 0,
      no2: aqRes?.hourly?.nitrogen_dioxide?.[i] || 0,
      so2: aqRes?.hourly?.sulphur_dioxide?.[i] || 0,
      dust: aqRes?.hourly?.dust?.[i] || 0,
      aod: aqRes?.hourly?.aerosol_optical_depth?.[i] ?? null,
    });
  }

  // Sun, moon & twilight events via SunCalc
  const dateObj = toUtc(date + 'T12:00:00');
  const sunTimes = SunCalc.getTimes(dateObj, latitude, longitude);

  const sunEvents = [];
  if (sunTimes.sunrise) sunEvents.push({ type: 'sunrise', time: fromUtc(sunTimes.sunrise), ...localTime(sunTimes.sunrise) });
  if (sunTimes.sunset) sunEvents.push({ type: 'sunset', time: fromUtc(sunTimes.sunset), ...localTime(sunTimes.sunset) });

  // Compute sun altitude for each hour (for twilight gradient lane)
  for (const item of combined) {
    const pos = SunCalc.getPosition(toUtc(item.time), latitude, longitude);
    item.sunAltitude = pos.altitude * (180 / Math.PI); // radians to degrees
  }

  const moonEvents = [];
  const moonTimes = SunCalc.getMoonTimes(dateObj, latitude, longitude);
  const moonIllum = SunCalc.getMoonIllumination(dateObj);
  if (moonTimes.rise) moonEvents.push({ type: 'moonrise', time: fromUtc(moonTimes.rise), ...localTime(moonTimes.rise), phase: moonIllum.phase, fraction: moonIllum.fraction });
  if (moonTimes.set) moonEvents.push({ type: 'moonset', time: fromUtc(moonTimes.set), ...localTime(moonTimes.set), phase: moonIllum.phase, fraction: moonIllum.fraction });

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

export function assembleTimeline(results) {
  const flatData = [];
  const globalSunEvents = [];
  const globalNightBands = [];
  const globalMoonEvents = [];

  let currentOffset = 0;
  for (const res of results) {
     if (!res || res.length === 0) continue;
     flatData.push(...res);

     if (res.sunEvents) {
        const cityStartTimeMs = new Date(res[0].time).getTime();
        const validSunEvents = [];

        res.sunEvents.forEach(ev => {
           const diffHours = (ev.time.getTime() - cityStartTimeMs) / 3600000;
           if (diffHours >= 0 && diffHours <= res.length) {
              const absIdx = currentOffset + diffHours;
              validSunEvents.push({ ...ev, absoluteIndex: absIdx });
              globalSunEvents.push({ ...ev, absoluteIndex: absIdx });
           }
        });

        validSunEvents.sort((a,b) => a.absoluteIndex - b.absoluteIndex);

        let currentNightStart = null;
        if (validSunEvents.length > 0 && validSunEvents[0].type === 'sunrise') {
           currentNightStart = currentOffset - 0.5;
        }

        validSunEvents.forEach(ev => {
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
           globalNightBands.push({ left: currentNightStart, right: currentOffset + res.length - 0.5 });
        }
     }

     if (res.moonEvents) {
        const cityStartTimeMs = new Date(res[0].time).getTime();
        res.moonEvents.forEach(ev => {
           const diffHours = (ev.time.getTime() - cityStartTimeMs) / 3600000;
           if (diffHours >= 0 && diffHours <= res.length) {
              globalMoonEvents.push({ ...ev, absoluteIndex: currentOffset + diffHours });
           }
        });
        // Attach phase info to the city's range
        globalMoonEvents.phase = globalMoonEvents.phase ?? res.moonEvents.phase;
        globalMoonEvents.fraction = globalMoonEvents.fraction ?? res.moonEvents.fraction;
     }

     currentOffset += res.length;
  }

  flatData.sunEvents = globalSunEvents;
  flatData.nightBands = globalNightBands;
  flatData.moonEvents = globalMoonEvents;

  return flatData;
}

async function fetchAndAssemble(route) {
  const results = await Promise.all(
    route.map(cityObj => fetchCityDataForDate(cityObj).catch(e => {
      console.error(e);
      return [];
    }))
  );
  return assembleTimeline(results);
}

// Streaming variant: calls onUpdate(timeline, {done, loaded, total}) as each city resolves
export function fetchAndAssembleStreaming(route, onUpdate) {
  const results = new Array(route.length).fill(null);
  let loaded = 0;
  const total = route.length;

  route.forEach((cityObj, idx) => {
    fetchCityDataForDate(cityObj)
      .catch(e => { console.error(e); return []; })
      .then(cityData => {
        results[idx] = cityData;
        loaded++;
        const timeline = assembleTimeline(results.map(r => r || []));
        onUpdate(timeline, { done: loaded === total, loaded, total });
      });
  });
}

export async function fetchFullTimeline() {
  const route = await parseRoute();
  return fetchAndAssemble(route);
}

export function fetchFullTimelineStreaming(onUpdate) {
  parseRoute().then(route => fetchAndAssembleStreaming(route, onUpdate));
}

export async function fetchTimelineForRoute(route) {
  return fetchAndAssemble(route);
}

export function fetchTimelineForRouteStreaming(route, onUpdate) {
  fetchAndAssembleStreaming(route, onUpdate);
}
