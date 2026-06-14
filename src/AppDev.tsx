import { useEffect, useMemo, useState } from 'react';
import Dashboard from './components/Dashboard';
import CapturePage from './components/CapturePage';
import OgImagePage from './components/OgImagePage';
import { useSearchParam } from './hooks/useSearchParam';
import type { MoonEventList, NightBand, SunEvent, WeatherTimeline } from './types/weather';

interface AppDevProps {
  testData: WeatherTimeline | undefined;
}

interface FixtureBundle {
  points: WeatherTimeline;
  sunEvents?: SunEvent[];
  moonEvents?: MoonEventList;
  nightBands?: NightBand[];
}

const EMPTY_TIMELINE: WeatherTimeline = [];

function reviveDates(events: { time: string | Date }[]): void {
  for (const e of events) {
    if (typeof e.time === 'string') e.time = new Date(e.time);
  }
}

function attachMeta(points: WeatherTimeline, bundle: FixtureBundle): WeatherTimeline {
  if (bundle.sunEvents) {
    reviveDates(bundle.sunEvents);
    points.sunEvents = bundle.sunEvents;
  }
  if (bundle.moonEvents) {
    reviveDates(bundle.moonEvents);
    points.moonEvents = bundle.moonEvents;
  }
  if (bundle.nightBands) points.nightBands = bundle.nightBands;
  return points;
}

export default function AppDev({ testData: propTestData }: AppDevProps) {
  const fixtureName = useSearchParam('fixture');
  const captureParam = useSearchParam('capture');
  const ogParam = useSearchParam('og');
  const ogHoursParam = useSearchParam('ogHours');
  const [fixtureData, setFixtureData] = useState<{ name: string; data: WeatherTimeline } | null>(null);

  useEffect(() => {
    if (!fixtureName) {
      return undefined;
    }

    let cancelled = false;

    fetch(`/fixtures/${encodeURIComponent(fixtureName)}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Fixture not found: ${fixtureName}`);
        return r.json() as Promise<FixtureBundle>;
      })
      .then(bundle => {
        if (!cancelled) setFixtureData({ name: fixtureName, data: attachMeta(bundle.points, bundle) });
      })
      .catch((err: unknown) => {
        console.error(`Failed to load fixture "${fixtureName}":`, err);
      });

    return () => { cancelled = true; };
  }, [fixtureName]);

  const testData = useMemo<WeatherTimeline | undefined>(() => {
    if (fixtureName) {
      if (fixtureData?.name === fixtureName) return fixtureData.data;
      return EMPTY_TIMELINE;
    }
    return propTestData;
  }, [fixtureName, fixtureData, propTestData]);

  const captureHours = captureParam ? Number(captureParam) : 0;
  const ogHours = ogHoursParam ? Number(ogHoursParam) : 72;
  if (ogParam === '1' && testData && testData.length > 0) {
    return <OgImagePage data={testData} hours={ogHours} />;
  }

  if (captureHours > 0 && testData && testData.length > 0) {
    return <CapturePage data={testData} hours={captureHours} />;
  }

  return <Dashboard testData={testData} />;
}
