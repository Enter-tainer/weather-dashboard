import { useMemo } from 'react';
import Dashboard from './components/Dashboard';
import { useSearchParam } from './hooks/useSearchParam';
import { generateMockTimeline } from './services/mockData';
import type { WeatherTimeline } from './types/weather';

function App() {
  const testMode = useSearchParam('test');
  const testData = useMemo<WeatherTimeline | undefined>(
    () => (testMode === 'weather' ? generateMockTimeline() : undefined),
    [testMode],
  );

  return <Dashboard testData={testData} />;
}

export default App;
