import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

const IMMERSIVE_VALUES = new Set(['1', 'true', 'yes', 'on']);

interface ImmersiveModeResult {
  immersiveMode: boolean;
  setImmersiveMode: (enabled: boolean) => void;
}

function isImmersiveValue(value: string | null): boolean {
  return IMMERSIVE_VALUES.has((value || '').toLowerCase());
}

export function useImmersiveMode(): ImmersiveModeResult {
  const immersiveParam = useSearchParam('immersive');
  const immersiveMode = useMemo(() => isImmersiveValue(immersiveParam), [immersiveParam]);

  const setImmersiveMode = useCallback((enabled: boolean) => {
    setSearchParam('immersive', enabled ? 'true' : null);
  }, []);

  return { immersiveMode, setImmersiveMode };
}
