import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCityDataForDate, assembleTimeline, fetchFullTimelineStreaming } from '../services/api';
import { parseSwitchableRoute, buildRouteForSelections } from '../services/urlParser';

export function useDashboardData(testData) {
  const [data, setData] = useState(testData || null);
  const [loadingDone, setLoadingDone] = useState(!!testData);
  const [dateSlots, setDateSlots] = useState(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (testData) return;

    const switchable = parseSwitchableRoute();
    if (switchable) {
      setDateSlots(switchable.dateSlots);
      const activeRoute = buildRouteForSelections(switchable.dateSlots);
      const results = new Array(activeRoute.length).fill(null);
      let loaded = 0;

      activeRoute.forEach((entry, idx) => {
        fetchCityDataForDate(entry)
          .catch(e => { console.error(e); return []; })
          .then(cityData => {
            results[idx] = cityData;
            loaded++;
            const timeline = assembleTimeline(results.map(r => r || []));
            if (timeline.length > 0) setData(timeline);
            if (loaded === activeRoute.length) {
              setLoadingDone(true);
              for (const slot of switchable.dateSlots) {
                for (let i = 0; i < slot.entries.length; i++) {
                  if (i === slot.activeIndex) continue;
                  const alt = { ...slot.entries[i], date: slot.date };
                  fetchCityDataForDate(alt).catch(() => {});
                }
              }
            }
          });
      });
    } else {
      fetchFullTimelineStreaming((timeline, { done }) => {
        if (timeline.length > 0) setData(timeline);
        if (done) setLoadingDone(true);
      });
    }
  }, [testData]);

  const switchInfo = useMemo(() => {
    const info = {};
    if (!dateSlots) return info;

    for (const slot of dateSlots) {
      if (slot.entries.length > 1) {
        const activeEntry = slot.entries[slot.activeIndex];
        info[activeEntry.originalName] = slot;
      }
    }
    return info;
  }, [dateSlots]);

  const handleCityClick = useCallback((cityName) => {
    if (switching || !dateSlots) return;
    const slot = dateSlots.find(s => s.entries[s.activeIndex].originalName === cityName);
    if (!slot || slot.entries.length <= 1) return;

    const newSlots = dateSlots.map(s => {
      if (s === slot) {
        return { ...s, activeIndex: (s.activeIndex + 1) % s.entries.length };
      }
      return s;
    });
    setDateSlots(newSlots);

    setSwitching(true);
    const route = buildRouteForSelections(newSlots);
    Promise.all(route.map(entry =>
      fetchCityDataForDate(entry).catch(e => { console.error(e); return []; })
    )).then(results => {
      setData(assembleTimeline(results));
      setSwitching(false);
    });
  }, [dateSlots, switching]);

  return {
    data,
    loadingDone,
    switching,
    switchInfo,
    handleCityClick,
  };
}
