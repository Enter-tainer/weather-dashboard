import { useEffect, useRef, useState } from 'react';
import { Camera, Maximize2, Menu, Minimize2, Monitor, Moon, Settings, Sun, X } from 'lucide-react';
import type { EffectiveTheme, ThemeMode } from '../hooks/useThemeMode';

interface MobileToolMenuProps {
  themeMode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  onThemeToggle: () => void;
  compactMode: boolean;
  onCompactToggle: () => void;
  onOpenRouteEditor: () => void;
  onEnterCaptureMode: () => void;
  captureDisabled: boolean;
}

const THEME_META = {
  auto: { Icon: Monitor, label: '自动主题' },
  light: { Icon: Sun, label: '亮色主题' },
  dark: { Icon: Moon, label: '暗色主题' },
} as const;

export default function MobileToolMenu({
  themeMode,
  effectiveTheme,
  onThemeToggle,
  compactMode,
  onCompactToggle,
  onOpenRouteEditor,
  onEnterCaptureMode,
  captureDisabled,
}: MobileToolMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { Icon: ThemeIcon, label: themeLabel } = THEME_META[themeMode] || THEME_META.auto;
  const themeTitle = `${themeLabel}${themeMode === 'auto' ? ` (${effectiveTheme})` : ''}`;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && !menu.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const runAndClose = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="mobile-tool-menu" ref={menuRef}>
      <button
        type="button"
        className="mobile-tool-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? '关闭工具菜单' : '打开工具菜单'}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className="mobile-tool-cluster" role="menu" aria-label="工具">
          <button
            type="button"
            role="menuitem"
            className="mobile-tool-action"
            onClick={() => runAndClose(onThemeToggle)}
            title={themeTitle}
            aria-label={themeTitle}
          >
            <ThemeIcon size={18} />
          </button>
          <button
            type="button"
            role="menuitem"
            className="mobile-tool-action"
            onClick={() => runAndClose(onCompactToggle)}
            title={compactMode ? '切换到完整视图' : '切换到紧凑视图'}
            aria-label={compactMode ? '切换到完整视图' : '切换到紧凑视图'}
          >
            {compactMode ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
          </button>
          <button
            type="button"
            role="menuitem"
            className="mobile-tool-action"
            onClick={() => runAndClose(onOpenRouteEditor)}
            title="路线设置"
            aria-label="路线设置"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            role="menuitem"
            className="mobile-tool-action"
            onClick={() => runAndClose(onEnterCaptureMode)}
            disabled={captureDisabled}
            title="截图"
            aria-label="进入截图模式"
          >
            <Camera size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
