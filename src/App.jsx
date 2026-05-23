import { useMemo } from 'react';
import Dashboard from './components/Dashboard';
import { useSearchParam } from './hooks/useSearchParam';
import { generateMockTimeline } from './services/mockData';

function App() {
  const testMode = useSearchParam('test');
  const testData = useMemo(
    () => (testMode === 'weather' ? generateMockTimeline() : undefined),
    [testMode],
  );

  return <Dashboard testData={testData} />;
}

export default App;
