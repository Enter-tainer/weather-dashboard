export type NullableNumber = number | null;
export type WeatherDataSource = 'forecast' | 'ensemble';
export type PrecipitationInterval = 'preceding-hour' | 'cell';

export interface CloudLevel {
  pressure: number;
  cover: NullableNumber;
  altitude: NullableNumber;
}

export interface SoundingLevel {
  pressure: number;
  temp: NullableNumber;
  dewPoint: NullableNumber;
  relativeHumidity: NullableNumber;
  altitude: NullableNumber;
  agl: NullableNumber;
  windSpeed: NullableNumber;
  windDir: NullableNumber;
  surface?: boolean;
}

export interface SkewTLevel {
  press: number;
  hght: number;
  temp: number;
  dwpt: number;
  wdir: number;
  wspd: number;
}

export interface TemperatureEnsemble {
  p10: NullableNumber;
  p25: NullableNumber;
  p50: NullableNumber;
  p75: NullableNumber;
  p90: NullableNumber;
}

export interface WeatherPoint {
  cityName: string;
  latitude?: number;
  longitude?: number;
  time: string;
  timeUtcMs?: number;
  /** End of the displayed interval for aggregated timeline points. */
  intervalEndUtcMs?: number;
  timezone?: string;
  utcOffsetSeconds?: number;
  hour: number;
  weatherCode: NullableNumber;
  temperature: NullableNumber;
  humidity: NullableNumber;
  dewPoint: NullableNumber;
  apparentTemp: NullableNumber;
  precipitation: NullableNumber;
  precipitationProb: NullableNumber;
  /** How precipitation and precipitation probability relate to `time`. */
  precipitationInterval?: PrecipitationInterval;
  windSpeed: NullableNumber;
  windGusts: NullableNumber;
  windDir: NullableNumber;
  visibility: NullableNumber;
  uvIndex: NullableNumber;
  pressure: NullableNumber;
  cape: NullableNumber;
  cloudCover: NullableNumber;
  cloudLow: NullableNumber;
  cloudMid: NullableNumber;
  cloudHigh: NullableNumber;
  boundaryLayerHeight?: NullableNumber | undefined;
  cloudByLevel?: CloudLevel[] | undefined;
  soundingLevels?: SoundingLevel[] | undefined;
  tempMembers?: number[] | undefined;
  tempEnsemble?: TemperatureEnsemble | undefined;
  precipMembers?: number[] | undefined;
  windMembers?: number[] | undefined;
  cloudMembers?: number[] | undefined;
  pressureMembers?: number[] | undefined;
  weatherCodeMembers?: number[] | undefined;
  aqiUS?: NullableNumber | undefined;
  aqiEU?: NullableNumber | undefined;
  pm25?: NullableNumber | undefined;
  pm10?: NullableNumber | undefined;
  co?: NullableNumber | undefined;
  no2?: NullableNumber | undefined;
  so2?: NullableNumber | undefined;
  dust?: NullableNumber | undefined;
  aod?: NullableNumber | undefined;
  sunAltitude?: number | undefined;
  moonPhase?: number | undefined;
  moonFraction?: number | undefined;
  dataSource?: WeatherDataSource | undefined;
}

export type PrecipitationType = 'rain' | 'snow';

export interface MinutelyPrecipitationPoint {
  fxTime: string;
  precip: number;
  type: PrecipitationType;
}

export interface MinutelyPrecipitation {
  updateTime: string;
  fxLink: string;
  summary: string;
  points: MinutelyPrecipitationPoint[];
}

export type SunEventType = 'sunrise' | 'sunset';
export type MoonEventType = 'moonrise' | 'moonset';

export interface AstroEventBase {
  time: Date;
  localHour: number;
  localMinute: number;
  absoluteIndex?: number;
}

export interface SunEvent extends AstroEventBase {
  type: SunEventType;
}

export interface MoonEvent extends AstroEventBase {
  type: MoonEventType;
  phase?: number;
  fraction?: number;
}

export interface NightBand {
  left: number;
  right: number;
}

export type MoonEventList = MoonEvent[] & {
  phase?: number;
  fraction?: number;
};

export interface WeatherTimeline extends Array<WeatherPoint> {
  sunEvents?: SunEvent[];
  moonEvents?: MoonEventList;
  nightBands?: NightBand[];
}

export interface RouteEntry {
  city?: string | undefined;
  date: string;
  originalName?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
}

export interface DateSlot {
  date: string;
  entries: RouteEntry[];
  activeIndex: number;
}

export interface SwitchableRoute {
  dateSlots: DateSlot[];
}

export interface CityDetails {
  latitude: number;
  longitude: number;
  timezone: string;
  name: string;
}

export interface DashboardScales {
  minTemp: number;
  maxTemp: number;
  minP: number;
  maxP: number;
  maxBft: number;
  tempSteps: number[];
}
