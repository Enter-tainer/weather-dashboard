import { createContext } from 'react';
import type { TimelineLayout } from '../services/timelineLayout';

export const TimelineLayoutContext = createContext<TimelineLayout | null>(null);
