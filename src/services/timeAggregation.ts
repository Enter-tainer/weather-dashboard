import type {
  MoonEventList,
  NightBand,
  SunEvent,
  WeatherPoint,
  WeatherTimeline,
} from '../types/weather';
import { getPrecipitationPointForCell, getWeatherPointIntervalEndMs } from './timelineTime';

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function max(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function sum(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((total, value) => total + value, 0);
}

function weatherSeverity(code: number | null): number {
  if (code == null) return -1;
  if ([95, 96, 99].includes(code)) return 700 + code;
  if ([75, 77, 82, 86].includes(code)) return 600 + code;
  if ([65, 67, 73, 81].includes(code)) return 500 + code;
  if ([61, 63, 66, 71, 80, 85].includes(code)) return 400 + code;
  if ([51, 53, 55, 56, 57].includes(code)) return 300 + code;
  if ([45, 48].includes(code)) return 200 + code;
  if (code >= 2) return 100 + code;
  return code;
}

function pickWeatherCode(items: WeatherPoint[]): number | null {
  return (
    items
      .map((item) => item.weatherCode)
      .filter((code): code is number => code != null)
      .sort((a, b) => weatherSeverity(b) - weatherSeverity(a))[0] ?? null
  );
}

function averageOptional(values: Array<number | null | undefined>): number | undefined {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return undefined;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function localDateKey(item: WeatherPoint): string {
  return item.time.slice(0, 10);
}

function sumPrecipitationMembers(items: WeatherPoint[]): number[] | undefined {
  const memberArrays = items
    .map((item) => item.precipMembers)
    .filter((members): members is number[] => members != null && members.length > 0);
  if (memberArrays.length === 0) return undefined;

  const memberCount = Math.max(...memberArrays.map((members) => members.length));
  return Array.from({ length: memberCount }, (_, memberIndex) =>
    memberArrays.reduce((total, members) => total + (members[memberIndex] ?? 0), 0),
  );
}

function aggregateWindow(
  items: WeatherPoint[],
  precipitationItems: WeatherPoint[] = items,
): WeatherPoint {
  const first = items[0];
  if (!first) {
    throw new Error('Cannot aggregate an empty weather window');
  }

  const weatherCode = pickWeatherCode(items);
  const aod = averageOptional(items.map((item) => item.aod));
  const aqiUS = averageOptional(items.map((item) => item.aqiUS));
  const aqiEU = averageOptional(items.map((item) => item.aqiEU));
  const boundaryLayerHeight = averageOptional(items.map((item) => item.boundaryLayerHeight));
  const pm25 = averageOptional(items.map((item) => item.pm25));
  const pm10 = averageOptional(items.map((item) => item.pm10));
  const co = averageOptional(items.map((item) => item.co));
  const no2 = averageOptional(items.map((item) => item.no2));
  const so2 = averageOptional(items.map((item) => item.so2));
  const dust = averageOptional(items.map((item) => item.dust));
  // Twilight is an exact-time curve. Keep the sample at the aggregate cell's start boundary.
  const sunAltitude = first.sunAltitude;
  const last = items[items.length - 1] ?? first;
  const intervalEndUtcMs = getWeatherPointIntervalEndMs(last);
  const precipMembers = sumPrecipitationMembers(precipitationItems);

  const result: WeatherPoint = {
    ...first,
    weatherCode,
    temperature: average(items.map((item) => item.temperature)),
    humidity: average(items.map((item) => item.humidity)),
    dewPoint: average(items.map((item) => item.dewPoint)),
    apparentTemp: average(items.map((item) => item.apparentTemp)),
    precipitation: sum(precipitationItems.map((item) => item.precipitation)),
    precipitationProb: max(precipitationItems.map((item) => item.precipitationProb)),
    precipitationInterval: 'cell',
    windSpeed: average(items.map((item) => item.windSpeed)),
    windGusts: max(items.map((item) => item.windGusts)),
    windDir: average(items.map((item) => item.windDir)),
    visibility: average(items.map((item) => item.visibility)),
    uvIndex: max(items.map((item) => item.uvIndex)),
    pressure: average(items.map((item) => item.pressure)),
    cape: max(items.map((item) => item.cape)),
    cloudCover: average(items.map((item) => item.cloudCover)),
    cloudLow: average(items.map((item) => item.cloudLow)),
    cloudMid: average(items.map((item) => item.cloudMid)),
    cloudHigh: average(items.map((item) => item.cloudHigh)),
    boundaryLayerHeight: boundaryLayerHeight ?? null,
    aod: aod ?? null,
    dataSource: items.some((item) => item.dataSource === 'ensemble')
      ? 'ensemble'
      : first.dataSource,
  };

  if (intervalEndUtcMs != null) result.intervalEndUtcMs = intervalEndUtcMs;
  if (precipMembers) result.precipMembers = precipMembers;

  if (aqiUS != null) result.aqiUS = Math.round(aqiUS);
  if (aqiEU != null) result.aqiEU = Math.round(aqiEU);
  if (pm25 != null) result.pm25 = pm25;
  if (pm10 != null) result.pm10 = pm10;
  if (co != null) result.co = co;
  if (no2 != null) result.no2 = no2;
  if (so2 != null) result.so2 = so2;
  if (dust != null) result.dust = dust;
  if (sunAltitude != null) result.sunAltitude = sunAltitude;

  return result;
}

function aggregateEvents<T extends SunEvent | MoonEventList[number]>(
  events: T[] | undefined,
  indexToGroup: number[],
  groupRanges: Array<{ start: number; end: number }>,
): T[] | undefined {
  if (!events) return undefined;

  return events.flatMap((event) => {
    if (event.absoluteIndex == null) return [event];
    const finalSourceBoundary = groupRanges[groupRanges.length - 1]?.end;
    if (event.absoluteIndex === finalSourceBoundary) {
      return [{ ...event, absoluteIndex: groupRanges.length }];
    }
    const sourceIndex = Math.max(0, Math.floor(event.absoluteIndex));
    const groupIndex = indexToGroup[sourceIndex];
    if (groupIndex == null) return [];
    const group = groupRanges[groupIndex] ?? { start: sourceIndex, end: sourceIndex + 1 };
    const groupLength = Math.max(1, group.end - group.start);
    const offsetWithinGroup = (event.absoluteIndex - group.start) / groupLength;
    return [{ ...event, absoluteIndex: groupIndex + Math.max(0, Math.min(1, offsetWithinGroup)) }];
  });
}

function aggregateNightBands(
  bands: NightBand[] | undefined,
  groupRanges: Array<{ start: number; end: number }>,
): NightBand[] | undefined {
  if (!bands) return undefined;
  const groupCount = groupRanges.length;

  const sourceToAggregate = (position: number): number => {
    if (position <= 0) return 0;

    for (let i = 0; i < groupRanges.length; i++) {
      const group = groupRanges[i];
      if (!group) continue;
      if (position >= group.start && position <= group.end) {
        const groupLength = Math.max(1, group.end - group.start);
        return i + (position - group.start) / groupLength;
      }
    }

    return groupCount;
  };

  return bands.flatMap((band) => {
    const left = Math.max(0, sourceToAggregate(band.left));
    const right = Math.min(groupCount, sourceToAggregate(band.right));
    if (right <= left) return [];
    return [{ left, right }];
  });
}

export function aggregateTimelineByHours(
  data: WeatherTimeline,
  stepHours: number,
): WeatherTimeline {
  if (stepHours <= 1 || data.length <= 1) return data;

  const aggregated = [] as unknown as WeatherTimeline;
  const groupRanges: Array<{ start: number; end: number }> = [];
  const indexToGroup: number[] = [];

  let index = 0;
  while (index < data.length) {
    const first = data[index];
    if (!first) break;
    const start = index;
    const dateKey = localDateKey(first);
    const group: WeatherPoint[] = [];

    while (index < data.length && group.length < stepHours) {
      const item = data[index];
      if (!item || item.cityName !== first.cityName || localDateKey(item) !== dateKey) break;
      indexToGroup[index] = aggregated.length;
      group.push(item);
      index += 1;
    }

    groupRanges.push({ start, end: index });
    const precipitationItems = group.flatMap((_, groupOffset) => {
      const point = getPrecipitationPointForCell(data, start + groupOffset);
      return point ? [point] : [];
    });
    aggregated.push(aggregateWindow(group, precipitationItems));
  }

  const sunEvents = aggregateEvents(data.sunEvents, indexToGroup, groupRanges);
  if (sunEvents) aggregated.sunEvents = sunEvents;

  const moonEvents = aggregateEvents(data.moonEvents, indexToGroup, groupRanges) as
    | MoonEventList
    | undefined;
  if (moonEvents) {
    if (data.moonEvents?.phase != null) moonEvents.phase = data.moonEvents.phase;
    if (data.moonEvents?.fraction != null) moonEvents.fraction = data.moonEvents.fraction;
    aggregated.moonEvents = moonEvents;
  }

  const nightBands = aggregateNightBands(data.nightBands, groupRanges);
  if (nightBands) aggregated.nightBands = nightBands;

  return aggregated;
}
