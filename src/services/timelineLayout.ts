export const DEFAULT_HOUR_WIDTH = 22;

export function getTimelineHourWidth(): number {
  return DEFAULT_HOUR_WIDTH;
}

export function getTimelineWidth(length: number, hourWidth = DEFAULT_HOUR_WIDTH): number {
  return Math.max(0, length) * hourWidth;
}

export function getHourLeft(index: number, hourWidth = DEFAULT_HOUR_WIDTH): number {
  return index * hourWidth;
}

export function getHourCenter(index: number, hourWidth = DEFAULT_HOUR_WIDTH): number {
  return getHourLeft(index, hourWidth) + hourWidth / 2;
}
