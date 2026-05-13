import { useCallback, useState } from 'react';

const COMPACT_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isCompactFromSearch(search) {
  const params = new URLSearchParams(search);
  return COMPACT_VALUES.has((params.get('compact') || '').toLowerCase());
}

export function useCompactMode() {
  const [compactMode, setCompactMode] = useState(() => isCompactFromSearch(window.location.search));

  const toggleCompactMode = useCallback(() => {
    setCompactMode(current => {
      const next = !current;
      const url = new URL(window.location.href);

      if (next) {
        url.searchParams.set('compact', '1');
      } else {
        url.searchParams.delete('compact');
      }

      window.history.replaceState({}, '', url.toString());
      return next;
    });
  }, []);

  return { compactMode, toggleCompactMode };
}
