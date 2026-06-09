import { createContext, useContext } from 'react';

export interface CanvasCaptureStatus {
  total: number;
  drawn: number;
  ready: boolean;
}

export interface CanvasCaptureRegistration {
  markDrawn: () => void;
  unregister: () => void;
}

export interface CanvasCaptureContextValue {
  registerCanvas: () => CanvasCaptureRegistration;
}

export const CanvasCaptureContext = createContext<CanvasCaptureContextValue | null>(null);

export function useCanvasCaptureContext(): CanvasCaptureContextValue | null {
  return useContext(CanvasCaptureContext);
}
