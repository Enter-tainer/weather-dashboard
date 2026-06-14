import { Columns2, Columns3, Columns4 } from 'lucide-react';
import type { TimeCompactStep } from '../hooks/useTimeCompactMode';

interface TimeCompactToggleProps {
  timeStepHours: TimeCompactStep;
  onToggle: () => void;
}

const STEP_META = {
  1: { Icon: Columns2, title: '切换到 3 小时一格' },
  3: { Icon: Columns3, title: '切换到 6 小时一格' },
  6: { Icon: Columns4, title: '切换到每小时一格' },
} as const;

export default function TimeCompactToggle({ timeStepHours, onToggle }: TimeCompactToggleProps) {
  const { Icon, title } = STEP_META[timeStepHours] || STEP_META[1];

  return (
    <button
      type="button"
      className="time-compact-toggle-btn"
      onClick={onToggle}
      title={title}
      aria-label={title}
    >
      <Icon size={20} />
    </button>
  );
}
