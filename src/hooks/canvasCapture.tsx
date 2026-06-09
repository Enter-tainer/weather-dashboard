import {
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  CanvasCaptureContext,
  type CanvasCaptureRegistration,
  type CanvasCaptureStatus,
} from './canvasCaptureContext';

interface CanvasCaptureProviderProps {
  children: ReactNode;
  onStatusChange?: ((status: CanvasCaptureStatus) => void) | undefined;
}

function toStatus(canvases: Map<number, boolean>): CanvasCaptureStatus {
  let drawn = 0;
  for (const isDrawn of canvases.values()) {
    if (isDrawn) drawn += 1;
  }

  const total = canvases.size;
  return { total, drawn, ready: total > 0 && drawn === total };
}

export function CanvasCaptureProvider({ children, onStatusChange }: CanvasCaptureProviderProps) {
  const nextIdRef = useRef(1);
  const canvasesRef = useRef(new Map<number, boolean>());

  const publish = useCallback(() => {
    const status = toStatus(canvasesRef.current);
    onStatusChange?.(status);
  }, [onStatusChange]);

  const registerCanvas = useCallback((): CanvasCaptureRegistration => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    canvasesRef.current.set(id, false);
    publish();

    let active = true;
    return {
      markDrawn: () => {
        if (!active || !canvasesRef.current.has(id)) return;
        if (canvasesRef.current.get(id)) return;
        canvasesRef.current.set(id, true);
        publish();
      },
      unregister: () => {
        if (!active) return;
        active = false;
        canvasesRef.current.delete(id);
        publish();
      },
    };
  }, [publish]);

  const value = useMemo(() => ({ registerCanvas }), [registerCanvas]);

  return (
    <CanvasCaptureContext.Provider value={value}>
      {children}
    </CanvasCaptureContext.Provider>
  );
}
