import { useContext } from 'react';
import { DashboardLayoutContext } from './dashboardLayoutContext';

export function useDashboardLayout() {
  return useContext(DashboardLayoutContext);
}
