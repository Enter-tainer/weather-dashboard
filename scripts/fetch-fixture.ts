/**
 * Fetches real weather data from Open-Meteo via the app's API layer
 * and saves the processed timeline as a fixture JSON file.
 *
 * Usage:
 *   tsx scripts/fetch-fixture.ts
 *   tsx scripts/fetch-fixture.ts --route "Beijing;London;Reykjavik;Tokyo"
 *   tsx scripts/fetch-fixture.ts --name my-route --route "Tokyo;Singapore"
 */

import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Shim browser globals required by src/services/cache.ts and api.ts
// ---------------------------------------------------------------------------

const store = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    store.set(key, value);
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  key(index: number): string | null {
    return [...store.keys()][index] ?? null;
  },
  get length(): number {
    return store.size;
  },
};

// cache.ts calls window.setTimeout for 429 retry backoff
(globalThis as any).window = globalThis;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    route: { type: 'string', default: 'Beijing;London;Reykjavik;Tokyo' },
    name: { type: 'string', default: 'default' },
  },
  strict: false,
});

const routeStr = values.route ?? 'Beijing;London;Reykjavik;Tokyo';
const fixtureName = values.name ?? 'default';

// ---------------------------------------------------------------------------
// Import app modules (must come AFTER shim setup)
// ---------------------------------------------------------------------------

const { fetchCityDataForDate, assembleTimeline } = await import('../src/services/api.js');

// ---------------------------------------------------------------------------
// Build RouteEntry[] from city list
// ---------------------------------------------------------------------------

interface RouteEntry {
  city?: string;
  date: string;
  originalName?: string;
}

function todayPlus(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const cities = routeStr
  .split(';')
  .map(s => s.trim())
  .filter(Boolean);

const entries: RouteEntry[] = cities.map((city, i) => ({
  city,
  date: todayPlus(i),
  originalName: city,
}));

// ---------------------------------------------------------------------------
// Fetch + assemble
// ---------------------------------------------------------------------------

console.log(`Fetching fixture "${fixtureName}"...`);
console.log(`Route: ${entries.map(e => `${e.originalName} (${e.date})`).join(' → ')}`);

const results = await Promise.all(
  entries.map(e =>
    fetchCityDataForDate(e).catch((err: unknown) => {
      console.error(`Failed to fetch ${e.originalName}:`, err);
      return [];
    })
  )
);

const timeline = assembleTimeline(
  results.filter(r => r.length > 0)
);

if (timeline.length === 0) {
  console.error('No data fetched. Aborting.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Write fixture
// ---------------------------------------------------------------------------

const fixturesDir = resolve(__dirname, '..', 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

const filePath = resolve(fixturesDir, `${fixtureName}.json`);

// JSON.stringify strips non-index array properties (sunEvents, moonEvents,
// nightBands), so we wrap them alongside the points array.
const fixture = {
  points: timeline,
  sunEvents: timeline.sunEvents,
  moonEvents: timeline.moonEvents,
  nightBands: timeline.nightBands,
};
writeFileSync(filePath, JSON.stringify(fixture));

const sizeMB = (statSync(filePath).size / (1024 * 1024)).toFixed(2);
const citiesFound = new Set(timeline.map((p: any) => p.cityName)).size;

console.log(`Fixture saved: ${filePath}`);
console.log(`  ${citiesFound} cities, ${timeline.length} hours, ${sizeMB} MB`);
