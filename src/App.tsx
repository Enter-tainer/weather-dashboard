import { useMemo } from 'react';
import Dashboard from './components/Dashboard';
import { useSearchParam } from './hooks/useSearchParam';
import { generateMockTimeline } from './services/mockData';
import type { WeatherTimeline } from './types/weather';
import AppDev from './AppDev';

function App() {
  const testMode = useSearchParam('test');
  const testData = useMemo<WeatherTimeline | undefined>(
    () => (testMode === 'weather' ? generateMockTimeline() : undefined),
    [testMode],
  );

  if (import.meta.env.DEV) {
    return <AppDev testData={testData} />;
  }

  return <Dashboard testData={testData} />;
}

export default App;
