import { createContext } from 'react';
import type { DisplayMode } from './useDisplayMode';

export const RenderProfileContext = createContext<DisplayMode>('color');
