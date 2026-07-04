import type {
  MoonEventList,
  NightBand,
  SunEvent,
  WeatherPoint,
  WeatherTimeline,
} from '../types/weather';
import { DEFAULT_HOUR_WIDTH } from './timelineLayout';

export const CAPTURE_COL_WIDTH = DEFAULT_HOUR_WIDTH;
export const MIN_CAPTURE_HOURS = 1;

export interface CaptureSelection {
  startIndex: number;
  endIndex: number;
}

export type CaptureDragMode = 'start' | 'end' | 'move';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCaptureSelection(
  selection: CaptureSelection,
  dataLength: number,
  minHours = MIN_CAPTURE_HOURS,
): CaptureSelection {
  const safeLength = Math.max(0, dataLength);
  if (safeLength === 0) return { startIndex: 0, endIndex: 0 };

  const safeMinHours = clamp(Math.round(minHours), 1, safeLength);
  const start = clamp(Math.round(selection.startIndex), 0, safeLength - safeMinHours);
  const end = clamp(Math.round(selection.endIndex), start + safeMinHours, safeLength);

  return { startIndex: start, endIndex: end };
}

export function captureSelectionFromViewport(
  scrollLeft: number,
  clientWidth: number,
  dataLength: number,
  hourWidth = CAPTURE_COL_WIDTH,
): CaptureSelection {
  const safeLength = Math.max(0, dataLength);
  if (safeLength === 0) return { startIndex: 0, endIndex: 0 };

  const startIndex = clamp(Math.floor(scrollLeft / hourWidth), 0, safeLength - 1);
  const endIndex = clamp(
    Math.ceil((scrollLeft + clientWidth) / hourWidth),
    startIndex + 1,
    safeLength,
  );

  return normalizeCaptureSelection({ startIndex, endIndex }, safeLength);
}

function localDateKey(item: WeatherPoint): string {
  return item.time.slice(0, 10);
}

function isSameCaptureDayBlock(item: WeatherPoint | undefined, anchor: WeatherPoint): boolean {
  return !!item && item.cityName === anchor.cityName && localDateKey(item) === localDateKey(anchor);
}

export function captureSelectionFromCurrentDay(
  scrollLeft: number,
  data: WeatherTimeline,
  hourWidth = CAPTURE_COL_WIDTH,
): CaptureSelection {
  const safeLength = Math.max(0, data.length);
  if (safeLength === 0) return { startIndex: 0, endIndex: 0 };

  const anchorIndex = clamp(Math.floor(scrollLeft / hourWidth), 0, safeLength - 1);
  const anchor = data[anchorIndex];
  if (!anchor)
    return normalizeCaptureSelection(
      { startIndex: 0, endIndex: Math.min(24, safeLength) },
      safeLength,
    );

  let startIndex = anchorIndex;
  let endIndex = anchorIndex + 1;

  while (startIndex > 0 && isSameCaptureDayBlock(data[startIndex - 1], anchor)) {
    startIndex -= 1;
  }

  while (endIndex < safeLength && isSameCaptureDayBlock(data[endIndex], anchor)) {
    endIndex += 1;
  }

  return normalizeCaptureSelection({ startIndex, endIndex }, safeLength);
}

export function updateCaptureSelectionByDrag(
  selection: CaptureSelection,
  dragMode: CaptureDragMode,
  deltaHours: number,
  dataLength: number,
  minHours = MIN_CAPTURE_HOURS,
): CaptureSelection {
  const current = normalizeCaptureSelection(selection, dataLength, minHours);
  if (dataLength <= 0) return current;

  if (dragMode === 'start') {
    return normalizeCaptureSelection(
      { ...current, startIndex: current.startIndex + deltaHours },
      dataLength,
      minHours,
    );
  }

  if (dragMode === 'end') {
    return normalizeCaptureSelection(
      { ...current, endIndex: current.endIndex + deltaHours },
      dataLength,
      minHours,
    );
  }

  const width = current.endIndex - current.startIndex;
  const startIndex = clamp(current.startIndex + deltaHours, 0, dataLength - width);
  return { startIndex, endIndex: startIndex + width };
}

function isEventInCaptureRange(
  absoluteIndex: number,
  startIndex: number,
  endIndex: number,
): boolean {
  return absoluteIndex >= startIndex - 0.5 && absoluteIndex <= endIndex - 0.5;
}

function sliceSunEvents(
  events: SunEvent[] | undefined,
  startIndex: number,
  endIndex: number,
): SunEvent[] | undefined {
  if (!events) return undefined;

  return events
    .filter(
      (event) =>
        event.absoluteIndex == null ||
        isEventInCaptureRange(event.absoluteIndex, startIndex, endIndex),
    )
    .map((event) => {
      const { absoluteIndex, ...rest } = event;
      return absoluteIndex == null ? rest : { ...rest, absoluteIndex: absoluteIndex - startIndex };
    });
}

function sliceMoonEvents(
  events: MoonEventList | undefined,
  startIndex: number,
  endIndex: number,
): MoonEventList | undefined {
  if (!events) return undefined;

  const sliced = events
    .filter(
      (event) =>
        event.absoluteIndex == null ||
        isEventInCaptureRange(event.absoluteIndex, startIndex, endIndex),
    )
    .map((event) => {
      const { absoluteIndex, ...rest } = event;
      return absoluteIndex == null ? rest : { ...rest, absoluteIndex: absoluteIndex - startIndex };
    }) as MoonEventList;

  if (events.phase != null) sliced.phase = events.phase;
  if (events.fraction != null) sliced.fraction = events.fraction;
  return sliced;
}

function sliceNightBands(
  bands: NightBand[] | undefined,
  startIndex: number,
  endIndex: number,
): NightBand[] | undefined {
  if (!bands) return undefined;

  const rangeLeft = startIndex - 0.5;
  const rangeRight = endIndex - 0.5;

  return bands.flatMap((band) => {
    const left = Math.max(band.left, rangeLeft);
    const right = Math.min(band.right, rangeRight);
    if (right <= left) return [];
    return [{ left: left - startIndex, right: right - startIndex }];
  });
}

export function sliceTimelineForCapture(
  data: WeatherTimeline,
  selection: CaptureSelection,
): WeatherTimeline {
  const normalized = normalizeCaptureSelection(selection, data.length);
  const { startIndex, endIndex } = normalized;
  const sliced = data.slice(startIndex, endIndex) as WeatherTimeline;

  const sunEvents = sliceSunEvents(data.sunEvents, startIndex, endIndex);
  if (sunEvents) sliced.sunEvents = sunEvents;

  const moonEvents = sliceMoonEvents(data.moonEvents, startIndex, endIndex);
  if (moonEvents) sliced.moonEvents = moonEvents;

  const nightBands = sliceNightBands(data.nightBands, startIndex, endIndex);
  if (nightBands) sliced.nightBands = nightBands;

  return sliced;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatDateTimeForFile(time: string): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    '-',
    pad2(date.getHours()),
  ].join('');
}

function formatDateTimeLabel(time: string): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time;
  return `${date.getMonth() + 1}/${date.getDate()} ${pad2(date.getHours())}:00`;
}

export function captureFileName(data: WeatherTimeline, selection: CaptureSelection): string {
  const normalized = normalizeCaptureSelection(selection, data.length);
  const first = data[normalized.startIndex];
  const last = data[normalized.endIndex - 1];
  const start = first ? formatDateTimeForFile(first.time) : 'start';
  const end = last ? formatDateTimeForFile(last.time) : 'end';
  return `weather-${start}-${end}.webp`;
}

export function captureRangeLabel(data: WeatherTimeline): string {
  const first = data[0];
  const last = data[data.length - 1];
  if (!first || !last) return '';
  return `${formatDateTimeLabel(first.time)} - ${formatDateTimeLabel(last.time)}`;
}

export function captureLocationLabel(data: WeatherTimeline): string {
  const first = data[0];
  const last = data[data.length - 1];
  if (!first || !last) return '';

  const uniqueCities = [...new Set(data.map((item) => item.cityName).filter(Boolean))];
  if (uniqueCities.length <= 1) return first.cityName;
  if (first.cityName === last.cityName) return `${first.cityName} 等 ${uniqueCities.length} 地点`;
  return `${first.cityName} -> ${last.cityName}`;
}
