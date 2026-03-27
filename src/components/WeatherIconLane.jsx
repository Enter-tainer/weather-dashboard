import './Dashboard.css';

// Static imports of weather icon SVGs from @bybas/weather-icons (fill style)
import clearDay from '@bybas/weather-icons/production/fill/all/clear-day.svg';
import clearNight from '@bybas/weather-icons/production/fill/all/clear-night.svg';
import partlyCloudyDay from '@bybas/weather-icons/production/fill/all/partly-cloudy-day.svg';
import partlyCloudyNight from '@bybas/weather-icons/production/fill/all/partly-cloudy-night.svg';
import overcastDay from '@bybas/weather-icons/production/fill/all/overcast-day.svg';
import overcastNight from '@bybas/weather-icons/production/fill/all/overcast-night.svg';
import fogDay from '@bybas/weather-icons/production/fill/all/fog-day.svg';
import fogNight from '@bybas/weather-icons/production/fill/all/fog-night.svg';
import partlyCloudyDayDrizzle from '@bybas/weather-icons/production/fill/all/partly-cloudy-day-drizzle.svg';
import partlyCloudyNightDrizzle from '@bybas/weather-icons/production/fill/all/partly-cloudy-night-drizzle.svg';
import drizzle from '@bybas/weather-icons/production/fill/all/drizzle.svg';
import sleet from '@bybas/weather-icons/production/fill/all/sleet.svg';
import partlyCloudyDayRain from '@bybas/weather-icons/production/fill/all/partly-cloudy-day-rain.svg';
import partlyCloudyNightRain from '@bybas/weather-icons/production/fill/all/partly-cloudy-night-rain.svg';
import rain from '@bybas/weather-icons/production/fill/all/rain.svg';
import partlyCloudyDaySnow from '@bybas/weather-icons/production/fill/all/partly-cloudy-day-snow.svg';
import partlyCloudyNightSnow from '@bybas/weather-icons/production/fill/all/partly-cloudy-night-snow.svg';
import snow from '@bybas/weather-icons/production/fill/all/snow.svg';
import snowflake from '@bybas/weather-icons/production/fill/all/snowflake.svg';
import partlyCloudyDayHail from '@bybas/weather-icons/production/fill/all/partly-cloudy-day-hail.svg';
import partlyCloudyNightHail from '@bybas/weather-icons/production/fill/all/partly-cloudy-night-hail.svg';
import hail from '@bybas/weather-icons/production/fill/all/hail.svg';
import thunderstormsDay from '@bybas/weather-icons/production/fill/all/thunderstorms-day.svg';
import thunderstormsNight from '@bybas/weather-icons/production/fill/all/thunderstorms-night.svg';
import thunderstormsDayRain from '@bybas/weather-icons/production/fill/all/thunderstorms-day-rain.svg';
import thunderstormsNightRain from '@bybas/weather-icons/production/fill/all/thunderstorms-night-rain.svg';
import notAvailable from '@bybas/weather-icons/production/fill/all/not-available.svg';

// WMO Weather Code → icon URL mapping
// Each entry: [dayIcon, nightIcon]
const WMO_ICON_MAP = {
  0:  [clearDay, clearNight],                                         // Clear sky
  1:  [partlyCloudyDay, partlyCloudyNight],                           // Mainly clear
  2:  [partlyCloudyDay, partlyCloudyNight],                           // Partly cloudy
  3:  [overcastDay, overcastNight],                                    // Overcast
  45: [fogDay, fogNight],                                              // Fog
  48: [fogDay, fogNight],                                              // Depositing rime fog
  51: [partlyCloudyDayDrizzle, partlyCloudyNightDrizzle],             // Light drizzle
  53: [drizzle, drizzle],                                              // Moderate drizzle
  55: [drizzle, drizzle],                                              // Dense drizzle
  56: [sleet, sleet],                                                  // Light freezing drizzle
  57: [sleet, sleet],                                                  // Dense freezing drizzle
  61: [partlyCloudyDayRain, partlyCloudyNightRain],                   // Slight rain
  63: [rain, rain],                                                    // Moderate rain
  65: [rain, rain],                                                    // Heavy rain
  66: [sleet, sleet],                                                  // Light freezing rain
  67: [sleet, sleet],                                                  // Heavy freezing rain
  71: [partlyCloudyDaySnow, partlyCloudyNightSnow],                   // Slight snow fall
  73: [snow, snow],                                                    // Moderate snow fall
  75: [snow, snow],                                                    // Heavy snow fall
  77: [snowflake, snowflake],                                          // Snow grains
  80: [partlyCloudyDayRain, partlyCloudyNightRain],                   // Slight rain showers
  81: [rain, rain],                                                    // Moderate rain showers
  82: [rain, rain],                                                    // Violent rain showers
  85: [partlyCloudyDaySnow, partlyCloudyNightSnow],                   // Slight snow showers
  86: [snow, snow],                                                    // Heavy snow showers
  95: [thunderstormsDay, thunderstormsNight],                          // Thunderstorm
  96: [thunderstormsDayRain, thunderstormsNightRain],                  // Thunderstorm + slight hail
  99: [hail, hail],                                                    // Thunderstorm + heavy hail
};

function getWeatherIconUrl(code, isNight) {
  const entry = WMO_ICON_MAP[code];
  if (!entry) return notAvailable;
  return isNight ? entry[1] : entry[0];
}

export default function WeatherIconLane({ data }) {
  return (
    <div className="lane weather-icon-lane" style={{ height: 'var(--lane-height-icon)' }}>
      <div className="lane-data">
        {data.map((item, index) => {
          // Only show icon every 3 hours to avoid clutter
          const showIcon = index % 3 === 0;

          return (
            <div key={index} className="lane-cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {showIcon && (
                 <img
                   src={getWeatherIconUrl(item.weatherCode, item.sunAltitude < 0)}
                   alt=""
                   width={22}
                   height={22}
                   style={{ display: 'block' }}
                 />
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
