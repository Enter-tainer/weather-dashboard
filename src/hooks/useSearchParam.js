import { useMemo, useSyncExternalStore } from 'react';
import { URL_CHANGE_EVENT, getCurrentSearch } from '../services/urlState';

function subscribeToUrlChanges(onStoreChange) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(URL_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(URL_CHANGE_EVENT, onStoreChange);
  };
}

export function useSearchParam(name) {
  const search = useSyncExternalStore(
    subscribeToUrlChanges,
    getCurrentSearch,
    () => '',
  );

  return useMemo(() => new URLSearchParams(search).get(name), [name, search]);
}
