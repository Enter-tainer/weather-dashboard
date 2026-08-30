import { useContext } from 'react';
import { RenderProfileContext } from './renderProfileContext';

export function useRenderProfile() {
  return useContext(RenderProfileContext);
}

export function useIsEink(): boolean {
  return useRenderProfile() === 'eink';
}
