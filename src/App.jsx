import Dashboard from './components/Dashboard';
import { generateMockTimeline } from './services/mockData';

function App() {
  const params = new URLSearchParams(window.location.search);
  const isTest = params.get('test') === 'weather';

  if (isTest) {
    const mockData = generateMockTimeline();
    return <Dashboard testData={mockData} />;
  }

  return <Dashboard />;
}

export default App;
