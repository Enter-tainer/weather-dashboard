import { TimelineLayoutContext } from '../hooks/timelineLayoutContext';
import type { TimelineLayout } from '../services/timelineLayout';
import type { ReactNode } from 'react';

interface TimelineLayoutProviderProps {
  layout: TimelineLayout;
  children: ReactNode;
}

export default function TimelineLayoutProvider({ layout, children }: TimelineLayoutProviderProps) {
  return <TimelineLayoutContext.Provider value={layout}>{children}</TimelineLayoutContext.Provider>;
}
