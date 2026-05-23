import { Maximize2, Minimize2 } from 'lucide-react';

interface CompactToggleProps {
  compactMode: boolean;
  onToggle: () => void;
}

export default function CompactToggle({ compactMode, onToggle }: CompactToggleProps) {
  return (
    <button
      type="button"
      className="compact-toggle-btn"
      onClick={onToggle}
      title={compactMode ? '切换到完整视图' : '切换到紧凑视图'}
      aria-label={compactMode ? '切换到完整视图' : '切换到紧凑视图'}
    >
      {compactMode ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
    </button>
  );
}
