import { createContext } from 'react';
import { getDashboardLayoutMetrics } from '../services/dashboardLayout';
import type { DashboardLayoutMetrics } from '../services/dashboardLayout';

export const DashboardLayoutContext = createContext<DashboardLayoutMetrics>(
  getDashboardLayoutMetrics('standard', 'landscape'),
);
