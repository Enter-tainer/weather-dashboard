import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

const COMPACT_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isCompactValue(value) {
  return COMPACT_VALUES.has((value || '').toLowerCase());
}

export function useCompactMode() {
  const compactParam = useSearchParam('compact');
  const compactMode = useMemo(() => isCompactValue(compactParam), [compactParam]);

  const toggleCompactMode = useCallback(() => {
    setSearchParam('compact', compactMode ? null : '1');
  }, [compactMode]);

  return { compactMode, toggleCompactMode };
}
