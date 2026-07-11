import { useContext, useMemo } from 'react';
import { TimelineLayoutContext } from './timelineLayoutContext';
import { createTimelineLayout, DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import type { TimelineLayout } from '../services/timelineLayout';

export function useTimelineLayout(length: number, hourWidth = DEFAULT_HOUR_WIDTH): TimelineLayout {
  const context = useContext(TimelineLayoutContext);
  const fallback = useMemo(() => createTimelineLayout(length, hourWidth), [hourWidth, length]);
  return context ?? fallback;
}
