/**
 * Mock data generator for testing the weather dashboard UI.
 * Produces 7 "city" segments (24h each) covering diverse weather scenarios.
 */
import { SOUNDING_PRESSURE_LEVELS, APPROX_PRESSURE_HEIGHTS, dewPointFromRh } from './sounding.js';

const PRESSURE_LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300];
const FALLBACK_ALT = {
  1000: 100, 925: 750, 850: 1500, 700: 3000,
  600: 4200, 500: 5500, 400: 7200, 300: 9000,
};

function sunAlt(hour) {
  // Solar noon at 12, max altitude 55°
  // Uses cosine: alt = maxAlt * cos(pi * (hour - 12) / 12)... no
  // Better: alt = maxAlt * sin(pi * (hour - sunrise) / (sunset - sunrise))
  // sunrise=6, sunset=18, dayLength=12
  const rad = Math.PI * (hour - 6) / 12;
  const raw = 55 * Math.sin(rad);
  // At night (hour<6 or hour>18), sin goes negative, which is correct
  return raw;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.round(rand(min, max));
}

function generateMembers(base, count, spread) {
  const members = [];
  for (let i = 0; i < count; i++) {
    members.push(Math.max(0, base + (Math.random() - 0.5) * 2 * spread));
  }
  return members;
}

function buildMockSounding(item) {
  const inversionLikely = item.humidity > 85 && (item.hour <= 10 || item.hour >= 20);
  return SOUNDING_PRESSURE_LEVELS.map((pressure) => {
    const agl = APPROX_PRESSURE_HEIGHTS[pressure] ?? 0;
    const km = agl / 1000;
    const inversionWarmNose = inversionLikely ? Math.max(0, 4 - agl / 180) : 0;
    const temp = item.temperature - 6.2 * km + inversionWarmNose;
    const rh = Math.max(8, Math.min(100, item.humidity - km * 11 + (item.cloudCover || 0) * 0.08));

    return {
      pressure,
      temp,
      dewPoint: dewPointFromRh(temp, rh),
      relativeHumidity: rh,
      altitude: agl,
      agl,
      windSpeed: item.windSpeed + km * 8,
      windDir: (item.windDir + km * 25) % 360,
    };
  });
}

// Generate ensemble weather code members: majority agree on primaryCode,
// some members may predict nearby/alternative codes for realism.
function generateWeatherCodeMembers(primaryCode, count = 10, agreement = 0.6) {
  // Map of plausible alternative codes grouped by weather category
  const alternatives = {
    0: [0, 1, 2],           // Clear → mainly clear, partly cloudy
    1: [0, 1, 2, 3],       // Mainly clear
    2: [1, 2, 3],           // Partly cloudy
    3: [2, 3, 45],          // Overcast
    45: [3, 45, 48],        // Fog
    48: [45, 48],           // Rime fog
    51: [0, 1, 51, 53],    // Light drizzle
    53: [51, 53, 55, 61],  // Moderate drizzle
    55: [53, 55, 61],      // Dense drizzle
    56: [51, 56, 57],      // Freezing drizzle
    57: [56, 57, 66],      // Dense freezing drizzle
    61: [51, 53, 61, 63, 80], // Slight rain
    63: [61, 63, 65, 81],  // Moderate rain
    65: [63, 65, 82],      // Heavy rain
    66: [61, 66, 67],      // Freezing rain
    67: [66, 67, 65],      // Heavy freezing rain
    71: [1, 2, 71, 73, 85], // Slight snow
    73: [71, 73, 75],      // Moderate snow
    75: [73, 75, 77, 86],  // Heavy snow
    77: [75, 77],          // Snow grains
    80: [1, 61, 80, 81],   // Slight rain showers
    81: [80, 81, 82, 63],  // Moderate rain showers
    82: [81, 82, 65, 95],  // Violent rain showers
    85: [71, 85, 86],      // Slight snow showers
    86: [75, 85, 86],      // Heavy snow showers
    95: [82, 95, 96],      // Thunderstorm
    96: [95, 96, 99],      // Thunderstorm + slight hail
    99: [96, 99, 95],      // Thunderstorm + heavy hail
  };
  const alts = alternatives[primaryCode] || [primaryCode];
  const members = [];
  for (let i = 0; i < count; i++) {
    if (Math.random() < agreement) {
      members.push(primaryCode);
    } else {
      members.push(alts[Math.floor(Math.random() * alts.length)]);
    }
  }
  return members;
}

function makeCloudByLevel(lowCover, midCover, highCover) {
  // Distribute coverage across pressure levels
  return PRESSURE_LEVELS.map(p => {
    let cover;
    if (p >= 850) cover = lowCover + rand(-5, 5);
    else if (p >= 600) cover = midCover + rand(-5, 5);
    else cover = highCover + rand(-5, 5);
    cover = Math.max(0, Math.min(100, cover));
    return { pressure: p, cover, altitude: FALLBACK_ALT[p] };
  });
}

function makeBaseDate(dayOffset) {
  const d = new Date('2026-03-27T00:00:00');
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function formatTime(baseDate, hour) {
  const d = new Date(baseDate);
  d.setHours(hour, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:00`;
}

// ——— Scenario generators (each returns 24 hourly items) ———

function clearDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    const isDay = alt > 0;
    const code = isDay ? (h >= 10 && h <= 14 ? 0 : 1) : 0;
    items.push({
      cityName: '晴天城',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: isDay ? 18 + 8 * Math.sin(Math.PI * (h - 6) / 12) : 12 + rand(-2, 2),
      humidity: isDay ? 35 + rand(-5, 5) : 55 + rand(-5, 5),
      dewPoint: 8 + rand(-2, 2),
      apparentTemp: isDay ? 17 + 7 * Math.sin(Math.PI * (h - 6) / 12) : 10 + rand(-2, 2),
      precipitation: 0,
      precipitationProb: 0,
      windSpeed: 5 + rand(0, 8),
      windGusts: 8 + rand(0, 12),
      windDir: 180 + rand(-30, 30),
      visibility: 25000 + rand(0, 10000),
      uvIndex: isDay ? Math.max(0, 8 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 1018 + rand(-2, 2),
      cape: isDay ? rand(0, 100) : 0,
      cloudCover: rand(0, 15),
      cloudLow: rand(0, 10),
      cloudMid: rand(0, 10),
      cloudHigh: rand(0, 20),
      cloudByLevel: makeCloudByLevel(rand(0, 10), rand(0, 10), rand(0, 20)),
      tempMembers: generateMembers(18 + 8 * Math.sin(Math.PI * (h - 6) / 12), 10, 3),
      precipMembers: generateMembers(0, 10, 0.1),
      windMembers: generateMembers(5 + rand(0, 8), 10, 3),
      cloudMembers: generateMembers(10, 10, 8),
      pressureMembers: generateMembers(1018, 10, 3),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.85),
      aqiUS: randInt(15, 40),
      aqiEU: randInt(10, 35),
      pm25: rand(3, 15),
      pm10: rand(5, 20),
      co: rand(100, 300),
      no2: rand(5, 20),
      so2: rand(1, 8),
      dust: rand(1, 10),
      sunAltitude: alt,
      moonPhase: 0.05, // new moon
      moonFraction: 0.03,
    });
  }
  return items;
}

function cloudyDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    // Transition: partly cloudy morning → overcast afternoon → partly cloudy evening
    let code, cloudLow, cloudMid, cloudHigh;
    if (h < 8) { code = 2; cloudLow = 20; cloudMid = 30; cloudHigh = 50; }
    else if (h < 16) { code = 3; cloudLow = 60; cloudMid = 70; cloudHigh = 80; }
    else { code = 2; cloudLow = 30; cloudMid = 40; cloudHigh = 45; }

    items.push({
      cityName: '多云镇',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: 14 + 5 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      humidity: 55 + rand(-5, 10),
      dewPoint: 7 + rand(-2, 2),
      apparentTemp: 13 + 4 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      precipitation: 0,
      precipitationProb: h >= 10 && h <= 15 ? randInt(10, 25) : randInt(0, 10),
      windSpeed: 8 + rand(0, 10),
      windGusts: 14 + rand(0, 15),
      windDir: 220 + rand(-40, 40),
      visibility: 15000 + rand(0, 10000),
      uvIndex: alt > 0 ? Math.max(0, 4 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 1013 + rand(-3, 3),
      cape: rand(0, 50),
      cloudCover: cloudLow * 0.3 + cloudMid * 0.3 + cloudHigh * 0.4,
      cloudLow: cloudLow + rand(-10, 10),
      cloudMid: cloudMid + rand(-10, 10),
      cloudHigh: cloudHigh + rand(-10, 10),
      cloudByLevel: makeCloudByLevel(cloudLow + rand(-10, 10), cloudMid + rand(-10, 10), cloudHigh + rand(-10, 10)),
      tempMembers: generateMembers(14 + 5 * Math.sin(Math.PI * (h - 6) / 12), 10, 2),
      precipMembers: generateMembers(0, 10, 0.2),
      windMembers: generateMembers(8, 10, 4),
      cloudMembers: generateMembers(60, 10, 20),
      pressureMembers: generateMembers(1013, 10, 3),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.7),
      aqiUS: randInt(25, 55),
      aqiEU: randInt(20, 45),
      pm25: rand(8, 25),
      pm10: rand(12, 35),
      co: rand(200, 400),
      no2: rand(10, 30),
      so2: rand(3, 12),
      dust: rand(5, 15),
      sunAltitude: alt,
      moonPhase: 0.15, // waxing crescent
      moonFraction: 0.15,
    });
  }
  return items;
}

function rainyDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    // 0-5: clear, 6-9: drizzle, 10-15: moderate rain, 16-19: heavy rain, 20-23: clearing
    let code, precip, precipProb;
    if (h < 6) { code = 1; precip = 0; precipProb = 5; }
    else if (h < 10) {
      code = [51, 53, 55][Math.min(2, h - 6)]; // drizzle: light→moderate→heavy
      precip = 0.2 + (h - 6) * 0.3;
      precipProb = 40 + (h - 6) * 15;
    } else if (h < 16) {
      code = [61, 63, 63, 65, 65, 65][h - 10]; // rain: light→moderate→heavy
      precip = 1.5 + (h - 10) * 1.2;
      precipProb = 70 + (h - 10) * 5;
    } else if (h < 20) {
      code = [80, 81, 82, 82][h - 16]; // rain showers: light→heavy
      precip = 3.0 + (h - 16) * 2;
      precipProb = 85 + (h - 16) * 3;
    } else {
      code = [63, 61, 3, 2][h - 20]; // clearing
      precip = Math.max(0, 2.0 - (h - 20) * 0.8);
      precipProb = Math.max(5, 60 - (h - 20) * 15);
    }

    items.push({
      cityName: '雨水市',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: 10 + 3 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      humidity: 75 + rand(0, 15),
      dewPoint: 9 + rand(-1, 2),
      apparentTemp: 8 + 2 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      precipitation: Math.max(0, precip + rand(-0.3, 0.3)),
      precipitationProb: Math.min(100, precipProb),
      windSpeed: 12 + rand(0, 10),
      windGusts: 20 + rand(0, 15),
      windDir: 270 + rand(-30, 30),
      visibility: precip > 2 ? 3000 + rand(0, 2000) : 8000 + rand(0, 5000),
      uvIndex: alt > 0 ? Math.max(0, 2 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 1005 + rand(-3, 3) - precip * 0.5,
      cape: precip > 3 ? rand(200, 600) : rand(0, 100),
      cloudCover: Math.min(100, 50 + precip * 10),
      cloudLow: Math.min(100, 40 + precip * 8),
      cloudMid: Math.min(100, 50 + precip * 6),
      cloudHigh: Math.min(100, 60 + precip * 4),
      cloudByLevel: makeCloudByLevel(
        Math.min(100, 40 + precip * 8),
        Math.min(100, 50 + precip * 6),
        Math.min(100, 60 + precip * 4)
      ),
      tempMembers: generateMembers(10, 10, 2),
      precipMembers: generateMembers(precip, 10, precip * 0.5 + 0.5),
      windMembers: generateMembers(12, 10, 5),
      cloudMembers: generateMembers(80, 10, 15),
      pressureMembers: generateMembers(1005, 10, 4),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.55),
      aqiUS: randInt(20, 50),
      aqiEU: randInt(15, 40),
      pm25: rand(5, 20),
      pm10: rand(8, 25),
      co: rand(150, 350),
      no2: rand(8, 25),
      so2: rand(2, 10),
      dust: rand(2, 8),
      sunAltitude: alt,
      moonPhase: 0.30, // first quarter
      moonFraction: 0.45,
    });
  }
  return items;
}

function snowDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    // Light snow morning, heavy snow afternoon, snow showers evening
    let code, precip, precipProb;
    if (h < 6) { code = 3; precip = 0; precipProb = 15; }
    else if (h < 10) { code = 71; precip = 0.3 + rand(0, 0.3); precipProb = 55; }
    else if (h < 14) { code = 73; precip = 0.8 + rand(0, 0.5); precipProb = 75; }
    else if (h < 18) { code = 75; precip = 1.5 + rand(0, 1.0); precipProb = 90; }
    else if (h < 21) { code = 77; precip = 0.5 + rand(0, 0.5); precipProb = 65; } // snow grains
    else { code = 85; precip = 0.2 + rand(0, 0.3); precipProb = 40; } // snow showers

    items.push({
      cityName: '暴雪县',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: -8 + 4 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      humidity: 85 + rand(0, 10),
      dewPoint: -10 + rand(-2, 2),
      apparentTemp: -15 + 3 * Math.sin(Math.PI * (h - 6) / 12) + rand(-2, 2),
      precipitation: Math.max(0, precip),
      precipitationProb: Math.min(100, precipProb),
      windSpeed: 15 + rand(0, 15),
      windGusts: 30 + rand(0, 20),
      windDir: 330 + rand(-40, 40),
      visibility: precip > 1 ? 500 + rand(0, 1000) : 3000 + rand(0, 3000),
      uvIndex: alt > 0 ? Math.max(0, 1.5 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 1000 + rand(-4, 4),
      cape: 0,
      cloudCover: 90 + rand(0, 10),
      cloudLow: 80 + rand(0, 15),
      cloudMid: 70 + rand(0, 20),
      cloudHigh: 85 + rand(0, 15),
      cloudByLevel: makeCloudByLevel(80 + rand(0, 15), 70 + rand(0, 20), 85 + rand(0, 15)),
      tempMembers: generateMembers(-8, 10, 3),
      precipMembers: generateMembers(precip, 10, 0.5),
      windMembers: generateMembers(15, 10, 8),
      cloudMembers: generateMembers(90, 10, 8),
      pressureMembers: generateMembers(1000, 10, 5),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.65),
      aqiUS: randInt(10, 30),
      aqiEU: randInt(8, 25),
      pm25: rand(2, 10),
      pm10: rand(3, 15),
      co: rand(80, 250),
      no2: rand(3, 15),
      so2: rand(1, 6),
      dust: rand(0, 5),
      sunAltitude: alt,
      moonPhase: 0.50, // full moon
      moonFraction: 1.0,
    });
  }
  return items;
}

function fogDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    // Heavy fog morning, gradually lifting, hazy afternoon
    let code, vis;
    if (h < 4) { code = 45; vis = 200 + rand(0, 300); }
    else if (h < 8) { code = 48; vis = 100 + rand(0, 200); } // rime fog (depositing)
    else if (h < 12) { code = 45; vis = 500 + h * 200; }
    else if (h < 18) { code = 2; vis = 5000 + rand(0, 5000); }
    else { code = 45; vis = 800 + rand(0, 1200); } // fog returns

    items.push({
      cityName: '雾霾谷',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: 5 + 3 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      humidity: code === 45 || code === 48 ? 95 + rand(0, 5) : 65 + rand(-5, 10),
      dewPoint: 4 + rand(-1, 2),
      apparentTemp: 3 + 2 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      precipitation: 0,
      precipitationProb: 5,
      windSpeed: 2 + rand(0, 4),
      windGusts: 5 + rand(0, 6),
      windDir: rand(0, 360),
      visibility: vis,
      uvIndex: alt > 0 && code !== 45 && code !== 48 ? Math.max(0, 3 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 1020 + rand(-2, 2),
      cape: 0,
      cloudCover: code === 45 || code === 48 ? 100 : 40 + rand(0, 20),
      cloudLow: code === 45 || code === 48 ? 100 : 20 + rand(0, 15),
      cloudMid: 15 + rand(0, 20),
      cloudHigh: 10 + rand(0, 25),
      cloudByLevel: makeCloudByLevel(
        code === 45 || code === 48 ? 100 : 20,
        15 + rand(0, 20),
        10 + rand(0, 25)
      ),
      tempMembers: generateMembers(5, 10, 2),
      precipMembers: generateMembers(0, 10, 0.1),
      windMembers: generateMembers(3, 10, 2),
      cloudMembers: generateMembers(70, 10, 25),
      pressureMembers: generateMembers(1020, 10, 2),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.8),
      aqiUS: randInt(80, 160), // poor AQI
      aqiEU: randInt(60, 120),
      pm25: rand(35, 80),
      pm10: rand(50, 120),
      co: rand(400, 800),
      no2: rand(30, 60),
      so2: rand(10, 30),
      dust: rand(20, 50),
      sunAltitude: alt,
      moonPhase: 0.65, // waning gibbous
      moonFraction: 0.75,
    });
  }
  return items;
}

function thunderstormDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    // Morning: freezing drizzle, afternoon: thunderstorms with hail, evening: freezing rain
    let code, precip, precipProb, cape;
    if (h < 6) { code = 3; precip = 0; precipProb = 10; cape = 50; }
    else if (h < 10) {
      code = h < 8 ? 56 : 57; // freezing drizzle
      precip = 0.3 + rand(0, 0.3);
      precipProb = 50;
      cape = 100 + h * 30;
    } else if (h < 16) {
      code = h < 13 ? 95 : (h < 15 ? 96 : 99); // thunderstorm → with hail
      precip = 5 + rand(0, 10);
      precipProb = 95;
      cape = 1500 + rand(0, 2000);
    } else if (h < 20) {
      code = h < 18 ? 66 : 67; // freezing rain
      precip = 2 + rand(0, 3);
      precipProb = 75;
      cape = 400 + rand(0, 300);
    } else {
      code = 3;
      precip = 0;
      precipProb = 10;
      cape = 50;
    }

    items.push({
      cityName: '雷暴岛',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: 2 + 6 * Math.sin(Math.PI * (h - 6) / 12) + rand(-1, 1),
      humidity: 70 + rand(0, 20),
      dewPoint: 1 + rand(-2, 2),
      apparentTemp: -2 + 4 * Math.sin(Math.PI * (h - 6) / 12) + rand(-2, 2),
      precipitation: Math.max(0, precip),
      precipitationProb: Math.min(100, precipProb),
      windSpeed: 20 + rand(0, 20),
      windGusts: 40 + rand(0, 30),
      windDir: 240 + rand(-50, 50),
      visibility: precip > 3 ? 1000 + rand(0, 2000) : 8000 + rand(0, 5000),
      uvIndex: alt > 0 ? Math.max(0, 2 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 995 + rand(-5, 5) - precip * 0.3,
      cape,
      cloudCover: precip > 0 ? 95 + rand(0, 5) : 60 + rand(0, 20),
      cloudLow: precip > 0 ? 90 + rand(0, 10) : 40 + rand(0, 20),
      cloudMid: precip > 0 ? 80 + rand(0, 15) : 30 + rand(0, 20),
      cloudHigh: precip > 0 ? 70 + rand(0, 20) : 50 + rand(0, 20),
      cloudByLevel: makeCloudByLevel(
        precip > 0 ? 90 : 40,
        precip > 0 ? 80 : 30,
        precip > 0 ? 70 : 50
      ),
      tempMembers: generateMembers(2, 10, 4),
      precipMembers: generateMembers(precip, 10, precip * 0.6 + 0.5),
      windMembers: generateMembers(20, 10, 10),
      cloudMembers: generateMembers(85, 10, 12),
      pressureMembers: generateMembers(995, 10, 6),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.5),
      aqiUS: randInt(30, 70),
      aqiEU: randInt(25, 55),
      pm25: rand(10, 30),
      pm10: rand(15, 40),
      co: rand(200, 500),
      no2: rand(15, 40),
      so2: rand(5, 20),
      dust: rand(8, 25),
      sunAltitude: alt,
      moonPhase: 0.80, // waning crescent
      moonFraction: 0.35,
    });
  }
  return items;
}

function mixedDay(dayOffset) {
  const base = makeBaseDate(dayOffset);
  const items = [];
  // Cycle through: clear → cloudy → drizzle → rain → thunderstorm → snow → fog → clear
  const hourCodes = [0, 0, 1, 2, 3, 3, 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 75, 73, 71, 45, 48, 1, 0];
  const hourPrecip = [0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.8, 1.0, 2.5, 5.0, 3.0, 5.0, 8.0, 10.0, 12.0, 1.5, 0.8, 0.3, 0, 0, 0, 0];

  for (let h = 0; h < 24; h++) {
    const alt = sunAlt(h);
    const code = hourCodes[h];
    const precip = hourPrecip[h];
    // Temperature drops through the day for variety
    const temp = 20 - h * 1.2 + rand(-1, 1);

    items.push({
      cityName: '彩虹村',
      time: formatTime(base, h),
      hour: h,
      weatherCode: code,
      temperature: temp,
      humidity: 40 + precip * 5 + rand(-5, 10),
      dewPoint: temp - 8 + rand(-2, 2),
      apparentTemp: temp - 3 + rand(-1, 1),
      precipitation: Math.max(0, precip + rand(-0.1, 0.1)),
      precipitationProb: precip > 0 ? Math.min(100, 30 + precip * 8) : randInt(0, 15),
      windSpeed: 5 + rand(0, 15),
      windGusts: 10 + rand(0, 25),
      windDir: (h * 15 + rand(-10, 10)) % 360,
      visibility: code === 45 || code === 48 ? 300 + rand(0, 500) : precip > 5 ? 2000 + rand(0, 2000) : 15000 + rand(0, 10000),
      uvIndex: alt > 0 && precip === 0 ? Math.max(0, 6 * Math.sin(Math.PI * (h - 6) / 12)) : 0,
      pressure: 1010 + rand(-5, 5),
      cape: code >= 95 ? 1000 + rand(0, 1500) : rand(0, 200),
      cloudCover: precip > 0 ? Math.min(100, 60 + precip * 5) : (code >= 2 ? 50 + rand(0, 30) : rand(0, 20)),
      cloudLow: precip > 0 ? 50 + rand(0, 30) : rand(0, 30),
      cloudMid: precip > 0 ? 40 + rand(0, 30) : rand(0, 25),
      cloudHigh: rand(10, 60),
      cloudByLevel: makeCloudByLevel(
        precip > 0 ? 50 + rand(0, 30) : rand(0, 30),
        precip > 0 ? 40 + rand(0, 30) : rand(0, 25),
        rand(10, 60)
      ),
      tempMembers: generateMembers(temp, 10, 4),
      precipMembers: generateMembers(precip, 10, precip * 0.5 + 0.3),
      windMembers: generateMembers(10, 10, 6),
      cloudMembers: generateMembers(50, 10, 25),
      pressureMembers: generateMembers(1010, 10, 5),
      weatherCodeMembers: generateWeatherCodeMembers(code, 10, 0.45),
      aqiUS: randInt(15, 100),
      aqiEU: randInt(10, 80),
      pm25: rand(5, 40),
      pm10: rand(8, 60),
      co: rand(100, 600),
      no2: rand(5, 40),
      so2: rand(2, 20),
      dust: rand(2, 30),
      sunAltitude: alt,
      moonPhase: 0.95, // waning crescent near new
      moonFraction: 0.08,
    });
  }
  return items;
}

// ——— Assemble all scenarios into a single timeline ———

export function generateMockTimeline() {
  const generators = [clearDay, cloudyDay, rainyDay, snowDay, fogDay, thunderstormDay, mixedDay];
  const allItems = [];
  const sunEvents = [];
  const moonEvents = [];
  const nightBands = [];

  let offset = 0;
  generators.forEach((gen, dayIdx) => {
    const items = gen(dayIdx).map(item => ({
      ...item,
      soundingLevels: buildMockSounding(item),
    }));
    allItems.push(...items);

    // Generate sun events (sunrise ~6.25, sunset ~18.33)
    const sunriseIdx = offset + 6.25;
    const sunsetIdx = offset + 18.33;
    const baseDate = makeBaseDate(dayIdx);

    const sunriseTime = new Date(baseDate);
    sunriseTime.setHours(6, 15, 0, 0);
    const sunsetTime = new Date(baseDate);
    sunsetTime.setHours(18, 20, 0, 0);

    sunEvents.push({ type: 'sunrise', time: sunriseTime, absoluteIndex: sunriseIdx });
    sunEvents.push({ type: 'sunset', time: sunsetTime, absoluteIndex: sunsetIdx });

    // Generate moon events (vary per day)
    const moonriseHour = 8 + dayIdx * 1.5; // moonrise shifts later each day
    const moonsetHour = moonriseHour + 11; // ~11h above horizon
    if (moonriseHour < 24) {
      const moonriseTime = new Date(baseDate);
      moonriseTime.setHours(Math.floor(moonriseHour), Math.round((moonriseHour % 1) * 60), 0, 0);
      moonEvents.push({
        type: 'moonrise', time: moonriseTime,
        absoluteIndex: offset + moonriseHour,
        phase: items[0].moonPhase,
        fraction: items[0].moonFraction,
      });
    }
    if (moonsetHour < 24) {
      const moonsetTime = new Date(baseDate);
      moonsetTime.setHours(Math.floor(moonsetHour), Math.round((moonsetHour % 1) * 60), 0, 0);
      moonEvents.push({
        type: 'moonset', time: moonsetTime,
        absoluteIndex: offset + moonsetHour,
        phase: items[0].moonPhase,
        fraction: items[0].moonFraction,
      });
    }

    // Night bands: before sunrise and after sunset
    if (dayIdx === 0) {
      nightBands.push({ left: offset - 0.5, right: sunriseIdx });
    } else {
      // Connect from previous sunset
      const prevSunset = (dayIdx - 1) * 24 + 18.33;
      nightBands.push({ left: prevSunset, right: sunriseIdx });
    }
    // After sunset to next sunrise (or end of last day)
    if (dayIdx === generators.length - 1) {
      nightBands.push({ left: sunsetIdx, right: offset + 23.5 });
    }

    offset += 24;
  });

  // Attach array-level properties
  allItems.sunEvents = sunEvents;
  allItems.moonEvents = moonEvents;
  allItems.nightBands = nightBands;

  return allItems;
}
