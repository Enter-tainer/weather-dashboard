import type { PropsWithChildren } from 'react';
import { RenderProfileContext } from './renderProfileContext';
import type { DisplayMode } from './useDisplayMode';

export default function RenderProfileProvider({
  displayMode,
  children,
}: PropsWithChildren<{ displayMode: DisplayMode }>) {
  return (
    <RenderProfileContext.Provider value={displayMode}>{children}</RenderProfileContext.Provider>
  );
}
