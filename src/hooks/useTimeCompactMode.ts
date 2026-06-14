import { useCallback, useMemo } from 'react';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

export type TimeCompactStep = 1 | 3 | 6;

interface TimeCompactModeResult {
  timeStepHours: TimeCompactStep;
  toggleTimeCompactMode: () => void;
}

function parseTimeStep(value: string | null): TimeCompactStep {
  const numeric = Number(value);
  if (numeric === 3 || numeric === 6) return numeric;
  return 1;
}

export function useTimeCompactMode(): TimeCompactModeResult {
  const param = useSearchParam('timeCompact');
  const timeStepHours = useMemo(() => parseTimeStep(param), [param]);

  const toggleTimeCompactMode = useCallback(() => {
    if (timeStepHours === 1) {
      setSearchParam('timeCompact', '3');
    } else if (timeStepHours === 3) {
      setSearchParam('timeCompact', '6');
    } else {
      setSearchParam('timeCompact', null);
    }
  }, [timeStepHours]);

  return { timeStepHours, toggleTimeCompactMode };
}
