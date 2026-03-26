import { parseRoute } from './urlParser.js';
import { getCached, setCache, cachedFetch, TTL_GEO, TTL_WEATHER } from './cache.js';
import SunCalc from 'suncalc';

export async function getCityDetails(cityName) {
  const cacheKey = `geo:${cityName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1&format=json`);
  const data = await res.json();
  if (data.results && data.results.length > 0) {
    const { latitude, longitude, timezone, name } = data.results[0];
    const result = { latitude, longitude, timezone: timezone || 'auto', name };
    setCache(cacheKey, result, TTL_GEO);
    return result;
  }
  throw new Error(`City not found: ${cityName}`);
}

export async function fetchCityDataForDate(cityObj) {
  const { city, date, originalName, lat, lon } = cityObj;
  let latitude, longitude, timezone, name;
  if (lat != null && lon != null) {
    latitude = lat;
    longitude = lon;
    timezone = 'auto';
    name = originalName || '当前位置';
  } else {
    ({ latitude, longitude, timezone, name } = await getCityDetails(city));
  }
  
  const tzParams = `&timezone=${encodeURIComponent(timezone)}&start_date=${date}&end_date=${date}`;

  // 1. 根据日期差动态选择最精确的集合模型
  const targetDate = new Date(date);
  const now = new Date();
  const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  let ensembleModel = 'gfs05'; // fallback for > 15 days (up to 35 days)
  if (diffDays <= 7) {
    // 7天内优先使用 icon_seamless，分辨率高
    ensembleModel = 'icon_seamless';
  } else if (diffDays <= 15) {
    // 8-15天内用 ecmwf_ifs04，中长期权威(51 members)
    ensembleModel = 'ecmwf_ifs04';
  }

  // Pressure levels for altitude-based cloud visualization
  const pressureLevels = [1000, 925, 850, 700, 600, 500, 400, 300];
  const cloudPressureParams = pressureLevels.map(p => `cloud_cover_${p}hPa`).join(',');
  const geopotentialParams = pressureLevels.map(p => `geopotential_height_${p}hPa`).join(',');

  // Forecast API
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,uv_index,surface_pressure,cape,${cloudPressureParams},${geopotentialParams}${tzParams}`;

  // Ensemble API
  const ensembleUrl = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,wind_speed_10m,cloud_cover,surface_pressure&models=${ensembleModel}${tzParams}`;

  // AQI API
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,dust${tzParams}`;

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

  const hoursCount = forecastRes.hourly.time.length;
  const combined = [];

  for (let i = 0; i < hoursCount; i++) {
    const tempMembers = [];
    const precipMembers = [];
    const windMembers = [];
    const cloudMembers = [];
    const pressureMembers = [];
    if (ensembleRes && ensembleRes.hourly) {
      for (const key in ensembleRes.hourly) {
        if (key.startsWith('temperature_2m_member') && ensembleRes.hourly[key][i] != null) tempMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('precipitation_member') && ensembleRes.hourly[key][i] != null) precipMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('wind_speed_10m_member') && ensembleRes.hourly[key][i] != null) windMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('cloud_cover_member') && ensembleRes.hourly[key][i] != null) cloudMembers.push(ensembleRes.hourly[key][i]);
        if (key.startsWith('surface_pressure_member') && ensembleRes.hourly[key][i] != null) pressureMembers.push(ensembleRes.hourly[key][i]);
      }
    }

    combined.push({
      cityName: originalName || name,
      time: forecastRes.hourly.time[i],
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
      visibility: forecastRes.hourly.visibility[i],
      
      uvIndex: forecastRes.hourly.uv_index?.[i] || 0,
      pressure: forecastRes.hourly.surface_pressure?.[i] || 1013,
      cape: forecastRes.hourly.cape?.[i] || 0,
      
      cloudCover: forecastRes.hourly.cloud_cover[i],
      cloudLow: forecastRes.hourly.cloud_cover_low[i],
      cloudMid: forecastRes.hourly.cloud_cover_mid[i],
      cloudHigh: forecastRes.hourly.cloud_cover_high[i],

      // Pressure-level cloud cover and geopotential heights for altitude visualization
      cloudByLevel: pressureLevels.map(p => ({
        pressure: p,
        cover: forecastRes.hourly[`cloud_cover_${p}hPa`]?.[i] || 0,
        altitude: forecastRes.hourly[`geopotential_height_${p}hPa`]?.[i] || null,
      })),

      tempMembers,
      precipMembers,
      windMembers,
      cloudMembers,
      pressureMembers,

      aqiUS: aqRes?.hourly?.us_aqi?.[i] || 0,
      aqiEU: aqRes?.hourly?.european_aqi?.[i] || 0,
      pm25: aqRes?.hourly?.pm2_5?.[i] || 0,
      pm10: aqRes?.hourly?.pm10?.[i] || 0,
      co: aqRes?.hourly?.carbon_monoxide?.[i] || 0,
      no2: aqRes?.hourly?.nitrogen_dioxide?.[i] || 0,
      so2: aqRes?.hourly?.sulphur_dioxide?.[i] || 0,
      dust: aqRes?.hourly?.dust?.[i] || 0,
    });
  }

  // Sun & moon events via SunCalc
  const dateObj = new Date(date + 'T12:00:00');
  const sunEvents = [];
  const sunTimes = SunCalc.getTimes(dateObj, latitude, longitude);
  if (sunTimes.sunrise) sunEvents.push({ type: 'sunrise', time: sunTimes.sunrise });
  if (sunTimes.sunset) sunEvents.push({ type: 'sunset', time: sunTimes.sunset });

  const moonEvents = [];
  const moonTimes = SunCalc.getMoonTimes(dateObj, latitude, longitude);
  const moonIllum = SunCalc.getMoonIllumination(dateObj);
  if (moonTimes.rise) moonEvents.push({ type: 'moonrise', time: moonTimes.rise, phase: moonIllum.phase, fraction: moonIllum.fraction });
  if (moonTimes.set) moonEvents.push({ type: 'moonset', time: moonTimes.set, phase: moonIllum.phase, fraction: moonIllum.fraction });

  // Add moon phase + fraction to each hourly data point
  for (const item of combined) {
    const illum = SunCalc.getMoonIllumination(new Date(item.time));
    item.moonPhase = illum.phase;
    item.moonFraction = illum.fraction;
  }

  combined.sunEvents = sunEvents;
  combined.moonEvents = moonEvents;
  return combined;
}

function assembleTimeline(results) {
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

export async function fetchFullTimeline() {
  const route = await parseRoute();
  return fetchAndAssemble(route);
}

export async function fetchTimelineForRoute(route) {
  return fetchAndAssemble(route);
}
