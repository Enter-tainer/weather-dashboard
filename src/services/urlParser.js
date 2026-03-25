export async function parseRoute() {
  const params = new URLSearchParams(window.location.search);
  const routeStr = params.get('route');

  if (!routeStr) {
    try {
      const coords = await getUserCoords();
      const cityName = await reverseGeocode(coords.latitude, coords.longitude);
      return generate7Days(null, null, cityName, coords.latitude, coords.longitude);
    } catch (e) {
      console.warn('Geolocation failed, falling back to Beijing:', e);
      return generate7Days('Beijing', null, '北京');
    }
  }

  // Custom format: ?route=City1:2024-03-26,City2:2024-03-27
  return routeStr.split(',').map(part => {
    const [city, date] = part.split(':');
    return { city, date, originalName: city };
  });
}

function generate7Days(city, _unused, originalName, lat, lon) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
    return lat != null
      ? { lat, lon, originalName, date }
      : { city, originalName, date };
  });
}

function getUserCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { timeout: 10000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`,
      { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' } }
    );
    const data = await res.json();
    const a = data.address || {};
    // 优先取城市 > 区县 > 省 > 国家
    return a.city || a.town || a.village || a.county || a.state || a.country || '当前位置';
  } catch {
    return '当前位置';
  }
}
