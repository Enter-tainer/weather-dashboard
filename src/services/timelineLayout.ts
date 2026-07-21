export const DEFAULT_HOUR_WIDTH = 22;
// Each expanded hour cell keeps a fixed 132px width so a 3-cell minutely region
// (covering the ≤2h forecast span plus headroom) is 396px wide overall.
export const MINUTELY_EXPANDED_SPAN = 3;
export const EXPANDED_MINUTELY_WIDTH = 132 * MINUTELY_EXPANDED_SPAN;

export interface TimelineLayout {
  length: number;
  hourWidth: number;
  expandedIndex: number | null;
  expandedSpan: number;
  expandedWidth: number;
  totalWidth: number;
  isExpandedColumn: (index: number) => boolean;
  getColumnWidth: (index: number) => number;
  getColumnLeft: (index: number) => number;
  getColumnCenter: (index: number) => number;
  getColumnIndexAt: (x: number) => number;
  /** Maps an hour offset to the timeline. Integer offsets are column boundaries. */
  getTimePosition: (position: number) => number;
  getRangeWidth: (startIndex: number, endIndex: number) => number;
}

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

/** Keeps merged runs compact outside the detail region and splits each expanded hour into a cell. */
export function splitRunsAtExpandedColumns<T extends { start: number; length: number }>(
  runs: T[],
  isExpandedColumn: (index: number) => boolean,
): T[] {
  const splitRuns: T[] = [];

  for (const run of runs) {
    const end = run.start + run.length;
    let index = run.start;

    while (index < end) {
      const start = index;
      if (isExpandedColumn(index)) {
        splitRuns.push({ ...run, start, length: 1 });
        index++;
        continue;
      }

      while (index < end && !isExpandedColumn(index)) index++;
      splitRuns.push({ ...run, start, length: index - start });
    }
  }

  return splitRuns;
}

export function createTimelineLayout(
  length: number,
  hourWidth = DEFAULT_HOUR_WIDTH,
  expandedIndex: number | null = null,
  expandedWidth = EXPANDED_MINUTELY_WIDTH,
  expandedSpan = 1,
): TimelineLayout {
  const safeLength = Math.max(0, length);
  const activeExpandedIndex =
    expandedIndex != null && expandedIndex >= 0 && expandedIndex < safeLength
      ? expandedIndex
      : null;
  const safeExpandedSpan =
    activeExpandedIndex == null
      ? 0
      : Math.max(1, Math.min(expandedSpan, safeLength - activeExpandedIndex));
  const safeExpandedWidth = Math.max(hourWidth * safeExpandedSpan, expandedWidth);
  const expandedColumnWidth =
    safeExpandedSpan > 0 ? safeExpandedWidth / safeExpandedSpan : hourWidth;
  const expandedEndIndex =
    activeExpandedIndex == null ? null : activeExpandedIndex + safeExpandedSpan;
  const extraWidth =
    activeExpandedIndex == null ? 0 : safeExpandedWidth - hourWidth * safeExpandedSpan;
  const totalWidth = safeLength * hourWidth + extraWidth;

  const isExpandedColumn = (index: number): boolean =>
    activeExpandedIndex != null &&
    expandedEndIndex != null &&
    index >= activeExpandedIndex &&
    index < expandedEndIndex;
  const getColumnWidth = (index: number): number =>
    isExpandedColumn(index) ? expandedColumnWidth : hourWidth;
  const getColumnLeft = (index: number): number => {
    const safeIndex = Math.max(0, index);
    if (
      activeExpandedIndex == null ||
      expandedEndIndex == null ||
      safeIndex <= activeExpandedIndex
    ) {
      return safeIndex * hourWidth;
    }
    if (safeIndex < expandedEndIndex) {
      return (
        activeExpandedIndex * hourWidth + (safeIndex - activeExpandedIndex) * expandedColumnWidth
      );
    }
    return safeIndex * hourWidth + extraWidth;
  };
  const getColumnCenter = (index: number): number =>
    getColumnLeft(index) + getColumnWidth(index) / 2;
  const getColumnIndexAt = (x: number): number => {
    if (safeLength === 0 || !Number.isFinite(x)) return 0;
    const safeX = Math.max(0, Math.min(totalWidth - Number.EPSILON, x));
    let low = 0;
    let high = safeLength - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const left = getColumnLeft(middle);
      const right = getColumnLeft(middle + 1);
      if (safeX < left) high = middle - 1;
      else if (safeX >= right) low = middle + 1;
      else return middle;
    }

    return Math.max(0, Math.min(safeLength - 1, low));
  };
  const getTimePosition = (position: number): number => {
    if (!Number.isFinite(position) || safeLength === 0) return 0;
    const columnPosition = Math.max(0, Math.min(safeLength, position));
    if (columnPosition >= safeLength) return totalWidth;
    const index = Math.floor(columnPosition);
    const fraction = columnPosition - index;
    return getColumnLeft(index) + getColumnWidth(index) * fraction;
  };
  const getRangeWidth = (startIndex: number, endIndex: number): number =>
    Math.max(0, getColumnLeft(endIndex) - getColumnLeft(startIndex));

  return {
    length: safeLength,
    hourWidth,
    expandedIndex: activeExpandedIndex,
    expandedSpan: safeExpandedSpan,
    expandedWidth: safeExpandedWidth,
    totalWidth,
    isExpandedColumn,
    getColumnWidth,
    getColumnLeft,
    getColumnCenter,
    getColumnIndexAt,
    getTimePosition,
    getRangeWidth,
  };
}
