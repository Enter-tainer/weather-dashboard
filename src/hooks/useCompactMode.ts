import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

const COMPACT_VALUES = new Set(['1', 'true', 'yes', 'on']);

interface CompactModeResult {
  compactMode: boolean;
  toggleCompactMode: () => void;
}

function isCompactValue(value: string | null): boolean {
  return COMPACT_VALUES.has((value || '').toLowerCase());
}

export function useCompactMode(): CompactModeResult {
  const compactParam = useSearchParam('compact');
  const compactMode = useMemo(() => isCompactValue(compactParam), [compactParam]);

  const toggleCompactMode = useCallback(() => {
    setSearchParam('compact', compactMode ? null : '1');
  }, [compactMode]);

  return { compactMode, toggleCompactMode };
}
