import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';

// IndexedDB via idb-keyval, not localStorage — a full library's worth of poster metadata across
// several carousels adds up to several MB, comfortably past localStorage's ~5-10MB per-origin
// quota in some browsers. IndexedDB's quota is a large share of free disk space instead.
export const queryPersister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: 'novaarr-query-cache',
  throttleTime: 1000,
});

// A restored dashboard is only useful for up to a day — past that it's more likely to mislead
// (a service renamed, a movie long since downloaded) than to save time, so a stale-enough cache
// is discarded outright in favor of the normal first-load skeleton.
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

// `services` carries every configured instance's raw API keys/tokens, and `auth` gates the lock
// screen — neither belongs in localStorage or benefits from being served stale, and both are
// small/fast to fetch fresh anyway. Everything else (proxy calls, dashboard widget config,
// poster lookups) is exactly the slow-to-fetch data this exists to speed up.
export function shouldDehydrateQuery(query: Query): boolean {
  const scope = query.queryKey[0];
  if (scope === 'services' || scope === 'auth') return false;
  return defaultShouldDehydrateQuery(query);
}
