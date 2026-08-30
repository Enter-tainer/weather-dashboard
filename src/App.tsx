import { useMemo } from 'react';
import Dashboard from './components/Dashboard';
import { useSearchParam } from './hooks/useSearchParam';
import { generateMockTimeline } from './services/mockData';
import type { WeatherTimeline } from './types/weather';
import AppDev from './AppDev';
import RenderProfileProvider from './hooks/RenderProfileProvider';
import { useDisplayMode } from './hooks/useDisplayMode';

function App() {
  const displayMode = useDisplayMode();
  const testMode = useSearchParam('test');
  const testData = useMemo<WeatherTimeline | undefined>(
    () => (testMode === 'weather' ? generateMockTimeline() : undefined),
    [testMode],
  );

  return (
    <RenderProfileProvider displayMode={displayMode}>
      {import.meta.env.DEV ? <AppDev testData={testData} /> : <Dashboard testData={testData} />}
    </RenderProfileProvider>
  );
}

export default App;
