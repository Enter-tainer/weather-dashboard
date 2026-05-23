export type NullableNumber = number | null;

export interface CloudLevel {
  pressure: number;
  cover: number;
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
  time: string;
  timeUtcMs?: number;
  timezone?: string;
  utcOffsetSeconds?: number;
  hour: number;
  weatherCode: number;
  temperature: number;
  humidity: number;
  dewPoint: number;
  apparentTemp: number;
  precipitation: number;
  precipitationProb: number;
  windSpeed: number;
  windGusts: number;
  windDir: number;
  visibility: number;
  uvIndex: number;
  pressure: number;
  cape: number;
  cloudCover: number;
  cloudLow: number;
  cloudMid: number;
  cloudHigh: number;
  boundaryLayerHeight?: NullableNumber;
  cloudByLevel?: CloudLevel[];
  soundingLevels?: SoundingLevel[];
  tempMembers?: number[];
  tempEnsemble?: TemperatureEnsemble;
  precipMembers?: number[];
  windMembers?: number[];
  cloudMembers?: number[];
  pressureMembers?: number[];
  weatherCodeMembers?: number[];
  aqiUS?: number;
  aqiEU?: number;
  pm25?: number;
  pm10?: number;
  co?: number;
  no2?: number;
  so2?: number;
  dust?: number;
  aod?: NullableNumber;
  sunAltitude?: number;
  moonPhase?: number;
  moonFraction?: number;
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
