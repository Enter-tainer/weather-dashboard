export const URL_CHANGE_EVENT = 'weather-dashboard-url-change';

export type UrlHistoryMode = 'push' | 'replace';

export interface UpdateSearchParamsOptions {
  history?: UrlHistoryMode;
}

export type SearchParamsUpdater = (params: URLSearchParams, url: URL) => void;

export function getCurrentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function getSearchParam(name: string): string | null {
  return new URLSearchParams(getCurrentSearch()).get(name);
}

function notifyUrlChanged(): void {
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

export function updateSearchParams(
  update: SearchParamsUpdater,
  { history = 'replace' }: UpdateSearchParamsOptions = {},
): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  update(url.searchParams, url);

  const method = history === 'push' ? 'pushState' : 'replaceState';
  window.history[method]({}, '', url.toString());
  notifyUrlChanged();
}

export function setSearchParam(
  name: string,
  value: string | number | null,
  options?: UpdateSearchParamsOptions,
): void {
  updateSearchParams((params) => {
    if (value == null || value === '') {
      params.delete(name);
      return;
    }

    params.set(name, String(value));
  }, options);
}
