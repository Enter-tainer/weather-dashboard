import { useMemo, useSyncExternalStore } from 'react';
import { URL_CHANGE_EVENT, getCurrentSearch } from '../services/urlState';

const noop = (): void => undefined;

function subscribeToUrlChanges(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return noop;

  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(URL_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(URL_CHANGE_EVENT, onStoreChange);
  };
}

export function useSearchParam(name: string): string | null {
  const search = useSyncExternalStore(
    subscribeToUrlChanges,
    getCurrentSearch,
    () => '',
  );

  return useMemo(() => new URLSearchParams(search).get(name), [name, search]);
}
