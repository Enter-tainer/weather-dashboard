export const URL_CHANGE_EVENT = 'weather-dashboard-url-change';

export function getCurrentSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function getSearchParam(name) {
  return new URLSearchParams(getCurrentSearch()).get(name);
}

function notifyUrlChanged() {
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

export function updateSearchParams(update, { history = 'replace' } = {}) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  update(url.searchParams, url);

  const method = history === 'push' ? 'pushState' : 'replaceState';
  window.history[method]({}, '', url.toString());
  notifyUrlChanged();
}

export function setSearchParam(name, value, options) {
  updateSearchParams((params) => {
    if (value == null || value === '') {
      params.delete(name);
      return;
    }

    params.set(name, value);
  }, options);
}
