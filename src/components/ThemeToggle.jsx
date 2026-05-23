import { Monitor, Moon, Sun } from 'lucide-react';

const MODE_META = {
  auto: {
    Icon: Monitor,
    label: '主题：自动',
    next: '亮色',
  },
  light: {
    Icon: Sun,
    label: '主题：亮色',
    next: '暗色',
  },
  dark: {
    Icon: Moon,
    label: '主题：暗色',
    next: '自动',
  },
};

export default function ThemeToggle({ mode, effectiveTheme, onToggle }) {
  const { Icon, label, next } = MODE_META[mode] || MODE_META.auto;
  const title = `${label}${mode === 'auto' ? ` (${effectiveTheme})` : ''}。点击切换到${next}`;

  return (
    <button
      type="button"
      className={`theme-toggle-btn is-${mode}`}
      onClick={onToggle}
      title={title}
      aria-label={title}
    >
      <Icon size={20} />
    </button>
  );
}
