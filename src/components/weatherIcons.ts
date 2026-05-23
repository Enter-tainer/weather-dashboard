export function getWeatherIcon(code: number): string {
  // WMO Weather interpretation codes
  if (code === 0) return '☀️'; // Clear sky
  if (code === 1) return '🌤️'; // Mainly clear
  if (code === 2) return '⛅'; // Partly cloudy
  if (code === 3) return '☁️'; // Overcast
  if ([45, 48].includes(code)) return '🌫️'; // Fog
  if ([51, 53, 55].includes(code)) return '🌧️'; // Drizzle
  if ([56, 57].includes(code)) return '🌧️'; // Freezing Drizzle
  if ([61, 63, 65].includes(code)) return '🌧️'; // Rain
  if ([66, 67].includes(code)) return '🌧️'; // Freezing Rain
  if ([71, 73, 75, 77].includes(code)) return '❄️'; // Snow fall
  if ([80, 81, 82].includes(code)) return '🌦️'; // Rain showers
  if ([85, 86].includes(code)) return '🌨️'; // Snow showers
  if ([95].includes(code)) return '⛈️'; // Thunderstorm
  if ([96, 99].includes(code)) return '⛈️'; // Thunderstorm with hail
  
  return '❓';
}
