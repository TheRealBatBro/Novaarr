import { useQuery } from '@tanstack/react-query';
import { useServiceProxy } from './queries';
import { apiUrl, proxyApi, type ProxyResponse, type ServiceInstance } from './api';
import { mapWithConcurrency } from './concurrency';

// Per-widget cap on simultaneous per-item proxy requests (poster/metadata lookups) — see
// concurrency.ts for why this exists.
const POSTER_FETCH_CONCURRENCY = 4;

export type WidgetSource = 'sonarr' | 'radarr' | 'overseerr' | 'trakt' | 'sabnzbd' | 'tautulli' | 'tracearr' | 'plex' | 'prowlarr' | 'nzbhydra2' | 'unraid' | 'jackett' | 'nzbget' | 'sickbeard' | 'ombi' | 'utorrent' | 'deluge' | 'transmission' | 'qbittorrent' | 'rutorrent';
export type RecommendationSeed = { title: string; mediaType: 'movie' | 'tv'; extraCount: number } | undefined;

export type WidgetDef = {
  key: string;
  title: string;
  source: WidgetSource;
  /** 'carousel' (default) renders a poster row; 'status' renders a compact live-stats card;
   * 'search' renders a compact search box that opens the request dialog on a result tap;
   * 'violations' renders Tracearr's recent-unacknowledged-violations list; 'stats' renders a
   * grid of library name + item count tiles. */
  kind?: 'carousel' | 'status' | 'search' | 'violations' | 'stats';
};

/** Every catalog entry above targets "the" (first/default) instance of its source — exactly what
 * every existing single-instance save already means, so it stays untouched. When a source has
 * *more* than one configured instance, this generates one extra `key@instanceId`-suffixed entry
 * per additional instance, titled with that instance's own displayName, so a second Sonarr (say)
 * gets its own selectable "Upcoming Episodes" widget instead of only ever reading the first one.
 * DashboardWidget.tsx parses the optional `@id` suffix back off when resolving which instance a
 * saved widget key actually points at. */
export function instanceWidgetCatalog(instances: ServiceInstance[]): WidgetDef[] {
  const bySource = new Map<string, ServiceInstance[]>();
  for (const i of instances) {
    const list = bySource.get(i.serviceId);
    if (list) list.push(i);
    else bySource.set(i.serviceId, [i]);
  }
  return WIDGET_CATALOG.flatMap((def) => {
    const extra = (bySource.get(def.source) ?? []).slice(1);
    return extra.map((instance): WidgetDef => ({ ...def, key: `${def.key}@${instance.id}`, title: `${def.title} — ${instance.displayName}` }));
  });
}

/** Splits a saved/catalog widget key into its base catalog key and an optional target instance id
 * (present only for the `key@instanceId` entries instanceWidgetCatalog generates). */
export function parseWidgetKey(widgetKey: string): { baseKey: string; instanceId?: number } {
  const at = widgetKey.indexOf('@');
  if (at === -1) return { baseKey: widgetKey };
  const instanceId = Number(widgetKey.slice(at + 1));
  return { baseKey: widgetKey.slice(0, at), instanceId: Number.isNaN(instanceId) ? undefined : instanceId };
}

// Inserts only genuinely-new catalog widgets (keys in `newKeys`, meaning no saved row exists for
// them at all yet — not merely disabled) into baseOrder, right after their nearest catalog
// neighbor that's already in baseOrder. Both the dashboard page and Settings > Dashboard need
// this same reconciliation — the dashboard for display order, Settings so a toggle/reorder there
// doesn't re-save a brand new widget at the tail and cement it there permanently, which is what
// actually happened here: the dashboard computed a good position for display, but Settings had
// its own separate (and simpler, always-append) reconciliation that won as soon as anything was
// saved from that page.
export function mergeNewWidgetsByCatalogPosition(baseOrder: string[], catalog: WidgetDef[], newKeys: Set<string>): string[] {
  const result = [...baseOrder];
  catalog.forEach((w, i) => {
    if (!newKeys.has(w.key)) return;
    let insertAt = result.length;
    for (let j = i - 1; j >= 0; j--) {
      const idx = result.indexOf(catalog[j].key);
      if (idx !== -1) {
        insertAt = idx + 1;
        break;
      }
    }
    result.splice(insertAt, 0, w.key);
  });
  return result;
}

// Trending/anticipated lists come from Trakt directly. We don't have a standalone TMDB
// integration, so Trakt list items (which carry a tmdb id but no artwork) get their poster art via
// Overseerr's own TMDB-backed movie/tv detail endpoints when available.
export const WIDGET_CATALOG: WidgetDef[] = [
  { key: 'sabnzbd-status', title: 'SABnzbd', source: 'sabnzbd', kind: 'status' },
  { key: 'nzbget-status', title: 'NZBGet', source: 'nzbget', kind: 'status' },
  { key: 'prowlarr-status', title: 'Prowlarr', source: 'prowlarr', kind: 'status' },
  { key: 'nzbhydra2-status', title: 'NZBHydra2', source: 'nzbhydra2', kind: 'status' },
  { key: 'unraid-status', title: 'Unraid', source: 'unraid', kind: 'status' },
  { key: 'jackett-status', title: 'Jackett', source: 'jackett', kind: 'status' },
  { key: 'sickbeard-status', title: 'Sick Beard', source: 'sickbeard', kind: 'status' },
  { key: 'ombi-status', title: 'Ombi', source: 'ombi', kind: 'status' },
  { key: 'utorrent-status', title: 'µTorrent', source: 'utorrent', kind: 'status' },
  { key: 'deluge-status', title: 'Deluge', source: 'deluge', kind: 'status' },
  { key: 'transmission-status', title: 'Transmission', source: 'transmission', kind: 'status' },
  { key: 'qbittorrent-status', title: 'qBittorrent', source: 'qbittorrent', kind: 'status' },
  { key: 'rutorrent-status', title: 'rTorrent / ruTorrent', source: 'rutorrent', kind: 'status' },
  { key: 'tautulli-status', title: 'Now Playing', source: 'tautulli', kind: 'status' },
  { key: 'overseerr-search', title: 'Search Seerr', source: 'overseerr', kind: 'search' },
  { key: 'tautulli-recent', title: 'Recently Watched', source: 'tautulli' },
  { key: 'tautulli-recommendations', title: 'Because You Watched', source: 'tautulli' },
  { key: 'tautulli-recently-added', title: 'Recently Added to Plex', source: 'tautulli' },
  { key: 'plex-recently-added', title: 'Recently Added', source: 'plex' },
  { key: 'plex-collections', title: 'Collections', source: 'plex' },
  { key: 'plex-library-stats', title: 'Library Stats', source: 'plex', kind: 'stats' },
  { key: 'tracearr-status', title: 'Streaming Activity', source: 'tracearr', kind: 'status' },
  { key: 'tracearr-violations', title: 'Rule Violations', source: 'tracearr', kind: 'violations' },
  { key: 'radarr-upcoming', title: 'Downloading Soon', source: 'radarr' },
  { key: 'radarr-recent', title: 'Recently Added Movies', source: 'radarr' },
  { key: 'sonarr-upcoming', title: 'Upcoming Episodes', source: 'sonarr' },
  { key: 'sonarr-recent', title: 'Recently Added Series', source: 'sonarr' },
  { key: 'overseerr-trending', title: 'Trending', source: 'overseerr' },
  { key: 'overseerr-popular-movies', title: 'Popular Movies', source: 'overseerr' },
  { key: 'overseerr-popular-tv', title: 'Popular TV Shows', source: 'overseerr' },
  { key: 'overseerr-upcoming-movies', title: 'Upcoming Movies', source: 'overseerr' },
  { key: 'trakt-anticipated-movies', title: 'Most Anticipated Movies', source: 'trakt' },
  { key: 'trakt-trending-movies', title: 'Trending Movies', source: 'trakt' },
  { key: 'trakt-anticipated-shows', title: 'Most Anticipated Shows', source: 'trakt' },
  { key: 'trakt-trending-shows', title: 'Trending Shows', source: 'trakt' },
];

// Mirrors db.js's REFRESH_INTERVAL_LIMITS — Trakt is a shared cloud API worth protecting with a
// higher floor than a self-hosted service on the local network. The server re-clamps on save
// regardless, this just keeps the Settings > Dashboard input's min/max honest up front.
export const REFRESH_INTERVAL_LIMITS: Record<string, { min: number; max: number }> = {
  trakt: { min: 60, max: 1440 },
  default: { min: 5, max: 1440 },
};

// staleTime matches refetchInterval so a page remount (navigating away and back, or a reload)
// doesn't force an immediate refetch just because the global 10s default elapsed — otherwise a
// deliberately long configured schedule (e.g. 12h) would be defeated by ordinary navigation.
function refreshSchedule(instance: ServiceInstance | undefined): { refetchInterval: number; staleTime: number } {
  const fallback = instance?.serviceId === 'trakt' ? 60 : 5;
  const ms = (instance?.refreshIntervalMinutes ?? fallback) * 60_000;
  return { refetchInterval: ms, staleTime: ms };
}

export const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w342';

export type PosterStatus = 'downloaded' | 'downloading' | 'upcoming' | 'missing';

export type CarouselLinkTarget = { serviceId: string; itemId?: string };
export type CarouselItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  rating?: number;
  status?: PosterStatus;
  to: CarouselLinkTarget;
  /** Overseerr/Trakt items have no dedicated detail page — clicking opens the existing
   * request dialog (fetches full TMDB detail + lets the user request it) instead of navigating. */
  overseerrDetail?: { mediaType: 'movie' | 'tv'; tmdbId: number };
};
export type CarouselResult = {
  items: CarouselItem[];
  isLoading: boolean;
  error?: string;
  seed?: RecommendationSeed;
  /** Present on widgets that run on a slow/cached schedule rather than the default ~10s poll —
   * DashboardCarousel shows a manual refresh button next to the source label when this is set. */
  refetch?: () => Promise<void>;
};

const LIMIT = 15;

// Every upstream service can return a non-array error body on auth failures, timeouts, or an
// unexpected shape (e.g. Trakt returns `{error, error_description}` on a bad Client ID) — the
// proxy always resolves 200 with that body tucked under `data` regardless of `ok`. Blindly
// calling .filter()/.sort()/.slice() on that would throw and take the whole dashboard down, so
// every carousel hook below reads its list through this guard instead of `data?.data ?? []`.
function asArray<T>(resp: ProxyResponse<T[]> | undefined): T[] {
  return resp?.ok && Array.isArray(resp.data) ? resp.data : [];
}

// A failed fetch and a legitimately-empty successful one both end up as an empty items array —
// DashboardCarousel needs to tell them apart to show a "couldn't load" state instead of just
// silently hiding, which is exactly what made a real Cloudflare block on Trakt look like nothing
// was wrong anywhere. `resp.error` is only set for network-level failures (timeout/DNS/blocked
// target); an HTTP-level failure (401/403/500) only has a status.
function proxyError(resp: ProxyResponse<unknown> | undefined): string | undefined {
  if (!resp || resp.ok) return undefined;
  return resp.error || `Server returned HTTP ${resp.status}`;
}

function isFutureDate(iso?: string): boolean {
  return !!iso && new Date(iso).getTime() > Date.now();
}

type ArrImage = { coverType: string; remoteUrl?: string; url?: string };
function arrPoster(images?: ArrImage[]): string | undefined {
  const img = images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

type RadarrMovie = {
  id: number;
  title: string;
  year?: number;
  monitored: boolean;
  hasFile?: boolean;
  added?: string;
  images?: ArrImage[];
  physicalRelease?: string;
  digitalRelease?: string;
  inCinemas?: string;
};
type RadarrQueueRecord = { movieId?: number };

function radarrStatus(m: RadarrMovie, downloadingIds: Set<number>): PosterStatus {
  if (m.hasFile) return 'downloaded';
  if (downloadingIds.has(m.id)) return 'downloading';
  const releaseDate = m.digitalRelease || m.physicalRelease || m.inCinemas;
  if (isFutureDate(releaseDate)) return 'upcoming';
  return 'missing';
}

export function useRadarrCarousel(instance: ServiceInstance | undefined, mode: 'upcoming' | 'recent'): CarouselResult {
  const { data, isLoading } = useServiceProxy<RadarrMovie[]>(instance, { path: '/api/v3/movie', ...refreshSchedule(instance) });
  const { data: queueData } = useServiceProxy<{ records?: RadarrQueueRecord[] }>(instance, {
    path: '/api/v3/queue',
    query: { pageSize: '200' },
    refetchInterval: 30_000,
  });
  const movies = asArray(data);
  const downloadingIds = new Set(
    (queueData?.ok ? queueData.data?.records ?? [] : [])
      .map((r) => r.movieId)
      .filter((id): id is number => typeof id === 'number'),
  );

  let list = movies;
  if (mode === 'upcoming') {
    list = movies
      .filter((m) => m.monitored && !m.hasFile && (m.physicalRelease || m.digitalRelease || m.inCinemas))
      .sort((a, b) => (a.physicalRelease || a.digitalRelease || a.inCinemas || '').localeCompare(b.physicalRelease || b.digitalRelease || b.inCinemas || ''));
  } else {
    list = [...movies].sort((a, b) => (b.added || '').localeCompare(a.added || ''));
  }

  const items: CarouselItem[] = list.slice(0, LIMIT).map((m) => ({
    id: String(m.id),
    title: m.title,
    subtitle: mode === 'upcoming' ? (m.physicalRelease || m.digitalRelease || m.inCinemas || '').slice(0, 10) : m.year ? String(m.year) : undefined,
    imageUrl: arrPoster(m.images),
    status: radarrStatus(m, downloadingIds),
    to: { serviceId: 'radarr', itemId: String(m.id) },
  }));

  return { items, isLoading, error: proxyError(data) };
}

type SonarrSeries = {
  id: number;
  title: string;
  year?: number;
  added?: string;
  images?: ArrImage[];
  status?: string;
  statistics?: { episodeFileCount?: number; episodeCount?: number };
};
type SonarrCalendarItem = {
  id: number;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  airDateUtc: string;
  seriesId: number;
  hasFile?: boolean;
  series?: { title: string; images?: ArrImage[] };
};

function sonarrSeriesStatus(s: SonarrSeries): PosterStatus {
  const stats = s.statistics;
  if (stats?.episodeCount && stats.episodeFileCount) {
    if (stats.episodeFileCount >= stats.episodeCount) return 'downloaded';
    return 'downloading';
  }
  if (s.status === 'upcoming') return 'upcoming';
  return 'missing';
}

export function useSonarrRecentCarousel(instance: ServiceInstance | undefined): CarouselResult {
  const { data, isLoading } = useServiceProxy<SonarrSeries[]>(instance, { path: '/api/v3/series', ...refreshSchedule(instance) });
  const series = [...asArray(data)].sort((a, b) => (b.added || '').localeCompare(a.added || ''));
  const items: CarouselItem[] = series.slice(0, LIMIT).map((s) => ({
    id: String(s.id),
    title: s.title,
    subtitle: s.year ? String(s.year) : undefined,
    imageUrl: arrPoster(s.images),
    status: sonarrSeriesStatus(s),
    to: { serviceId: 'sonarr', itemId: String(s.id) },
  }));
  return { items, isLoading, error: proxyError(data) };
}

function sonarrEpisodeStatus(ep: SonarrCalendarItem): PosterStatus {
  if (ep.hasFile) return 'downloaded';
  if (isFutureDate(ep.airDateUtc)) return 'upcoming';
  return 'missing';
}

export function useSonarrUpcomingCarousel(instance: ServiceInstance | undefined): CarouselResult {
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, isLoading } = useServiceProxy<SonarrCalendarItem[]>(instance, {
    path: '/api/v3/calendar',
    query: { start, end, includeSeries: 'true' },
    ...refreshSchedule(instance),
  });
  const episodes = [...asArray(data)].sort((a, b) => a.airDateUtc.localeCompare(b.airDateUtc));
  const items: CarouselItem[] = episodes.slice(0, LIMIT).map((ep) => ({
    id: String(ep.id),
    title: ep.series?.title ?? 'Unknown series',
    subtitle: `S${ep.seasonNumber}E${ep.episodeNumber}`,
    imageUrl: arrPoster(ep.series?.images),
    status: sonarrEpisodeStatus(ep),
    to: { serviceId: 'sonarr', itemId: String(ep.seriesId) },
  }));
  return { items, isLoading, error: proxyError(data) };
}

// Media availability enum (shared with Overseerr's own screens): 1=unknown, 2=pending,
// 3=processing, 4=partially available, 5=available. `mediaInfo` itself is only present once
// Overseerr has a Media row for the title (i.e. it's been requested or already exists in
// Radarr/Sonarr) — a bare discover/trending result with no request at all has no `mediaInfo`
// key, same as status 1/unknown. Neither of those means "missing"; it means "not tracked", so
// no dot at all. A real "missing" dot is reserved for what's actually requested/tracked, past
// its release date, and still not grabbed (status 2/pending) — not "processing" (3, actively
// grabbing) or "partially available" (4, some of it already is).
function tmdbStatus(info: { releaseDate?: string; firstAirDate?: string; mediaInfo?: { status?: number } }): PosterStatus | undefined {
  const s = info.mediaInfo?.status;
  if (s === undefined || s === 1) return undefined;
  if (s === 5) return 'downloaded';
  const date = info.releaseDate || info.firstAirDate;
  if (isFutureDate(date)) return 'upcoming';
  if (s === 3 || s === 4) return 'downloading';
  return 'missing';
}

// Overseerr's discover endpoints — same shape as its own web UI uses, but not verified against
// a live instance in this session; if the path/shape is off, this just yields an empty carousel.
type OverseerrDiscoverItem = {
  id: number;
  mediaType?: 'movie' | 'tv';
  title?: string;
  name?: string;
  posterPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: { status?: number };
};
type OverseerrDiscoverResponse = { results?: OverseerrDiscoverItem[] };

export function useOverseerrCarousel(instance: ServiceInstance | undefined, path: string): CarouselResult {
  const { data, isLoading } = useServiceProxy<OverseerrDiscoverResponse>(instance, { path, ...refreshSchedule(instance), timeoutMs: 15_000 });
  const results = data?.ok && Array.isArray(data.data?.results) ? data.data!.results! : [];
  const items: CarouselItem[] = results.slice(0, LIMIT).map((r) => {
    const date = r.releaseDate || r.firstAirDate;
    const mediaType = r.mediaType ?? 'movie';
    return {
      id: `${mediaType}-${r.id}`,
      title: r.title ?? r.name ?? 'Untitled',
      subtitle: date ? date.slice(0, 4) : undefined,
      imageUrl: r.posterPath ? `${TMDB_IMAGE}${r.posterPath}` : undefined,
      rating: r.voteAverage ? Math.round(r.voteAverage * 10) / 10 : undefined,
      status: tmdbStatus(r),
      overseerrDetail: { mediaType, tmdbId: r.id },
      to: { serviceId: 'overseerr' },
    };
  });
  return { items, isLoading, error: proxyError(data) };
}

type TautulliHistoryEntry = {
  id: number;
  media_type: 'movie' | 'episode' | 'track' | 'clip';
  title: string;
  full_title: string;
  grandparent_title?: string;
  year?: number;
  media_index?: number | string;
  parent_media_index?: number | string;
  thumb?: string;
  rating_key?: number | string;
  grandparent_rating_key?: number | string;
};
type TautulliHistoryResponse = { response?: { result: string; data?: { data?: TautulliHistoryEntry[] } } };

export function useTautulliRecentCarousel(instance: ServiceInstance | undefined): CarouselResult {
  const { data, isLoading } = useServiceProxy<TautulliHistoryResponse>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_history', order_column: 'date', order_dir: 'desc', length: String(LIMIT) },
    ...refreshSchedule(instance),
  });
  const rawRows = data?.ok ? data.data?.response?.data?.data : undefined;
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const items: CarouselItem[] = rows.map((r) => {
    const isEpisode = r.media_type === 'episode';
    const subtitle = isEpisode
      ? r.parent_media_index !== undefined && r.media_index !== undefined
        ? `S${r.parent_media_index}E${String(r.media_index).padStart(2, '0')}`
        : undefined
      : r.year
        ? String(r.year)
        : undefined;
    return {
      id: String(r.id),
      title: isEpisode ? r.grandparent_title || r.full_title : r.title || r.full_title,
      subtitle,
      imageUrl: r.thumb && instance ? apiUrl(`/api/tautulli/${instance.id}/image?${new URLSearchParams({ img: r.thumb, width: '300', height: '450' })}`) : undefined,
      to: { serviceId: 'tautulli' },
    };
  });
  return { items, isLoading, error: proxyError(data) };
}

// Confirmed live: get_recently_added nests under response.data.recently_added (not
// response.data.data like get_history) — Tautulli's API shape isn't consistent between commands.
type TautulliRecentlyAddedEntry = {
  media_type: 'movie' | 'episode' | 'season' | 'show' | 'track' | 'clip';
  rating_key: string;
  title: string;
  full_title: string;
  grandparent_title?: string;
  parent_media_index?: string;
  media_index?: string;
  year?: string;
  thumb?: string;
  grandparent_thumb?: string;
  added_at: string;
};
type TautulliRecentlyAddedResponse = { response?: { result: string; data?: { recently_added?: TautulliRecentlyAddedEntry[] } } };

export function useTautulliRecentlyAddedCarousel(instance: ServiceInstance | undefined): CarouselResult {
  const { data, isLoading, refetch } = useServiceProxy<TautulliRecentlyAddedResponse>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_recently_added', count: String(LIMIT) },
    ...refreshSchedule(instance),
  });
  const rawRows = data?.ok ? data.data?.response?.data?.recently_added : undefined;
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const items: CarouselItem[] = rows.map((r) => {
    const isEpisode = r.media_type === 'episode';
    const thumb = isEpisode ? r.grandparent_thumb || r.thumb : r.thumb;
    const subtitle = isEpisode
      ? r.parent_media_index !== undefined && r.media_index !== undefined
        ? `S${r.parent_media_index}E${String(r.media_index).padStart(2, '0')}`
        : undefined
      : r.year;
    return {
      id: r.rating_key,
      title: isEpisode ? r.grandparent_title || r.full_title : r.title || r.full_title,
      subtitle,
      imageUrl: thumb && instance ? apiUrl(`/api/tautulli/${instance.id}/image?${new URLSearchParams({ img: thumb, width: '300', height: '450' })}`) : undefined,
      to: { serviceId: 'tautulli' },
    };
  });
  return { items, isLoading, error: proxyError(data), refetch: async () => void (await refetch()) };
}

type TraktIds = { tmdb?: number };
type TraktMovieOrShow = { title: string; year?: number; ids?: TraktIds };
type TraktListEntry = { movie?: TraktMovieOrShow; show?: TraktMovieOrShow } & TraktMovieOrShow;
type TmdbPosterInfo = { posterPath?: string; releaseDate?: string; firstAirDate?: string; mediaInfo?: { status?: number } };

export function useTraktCarousel(
  trakt: ServiceInstance | undefined,
  overseerr: ServiceInstance | undefined,
  path: string,
  mediaType: 'movie' | 'tv',
): CarouselResult {
  const listQuery = useServiceProxy<TraktListEntry[]>(trakt, { path, ...refreshSchedule(trakt), timeoutMs: 15_000 });
  const raw = asArray(listQuery.data).slice(0, LIMIT).map((entry) => entry.movie ?? entry.show ?? entry).filter((m) => m?.title);
  const tmdbIds = raw.map((m) => m.ids?.tmdb).filter((id): id is number => typeof id === 'number');

  const postersQuery = useQuery({
    queryKey: ['trakt-posters', overseerr?.id, mediaType, tmdbIds.join(',')],
    queryFn: async () => {
      // Capped at POSTER_FETCH_CONCURRENCY, not fired all at once — with 4 Trakt widgets each
      // resolving ~15 posters, an uncapped Promise.all here was 40-60 simultaneous requests on
      // a single dashboard load, easily enough to make unrelated slower-network requests queue
      // past their own timeout. Each lookup stays isolated (try/catch) so one flaky request still
      // can't blank out the rest of the batch.
      const entries = await mapWithConcurrency(tmdbIds, POSTER_FETCH_CONCURRENCY, async (id) => {
        try {
          const res = await proxyApi.call<TmdbPosterInfo>(overseerr!.id, {
            path: `/api/v1/${mediaType}/${id}`,
            timeoutMs: 8000,
          });
          return [id, res.ok ? res.data : undefined] as const;
        } catch {
          return [id, undefined] as const;
        }
      });
      return Object.fromEntries(entries) as Record<number, TmdbPosterInfo | undefined>;
    },
    enabled: !!overseerr && tmdbIds.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const items: CarouselItem[] = raw.map((m, i) => {
    const tmdbId = m.ids?.tmdb;
    const info = tmdbId !== undefined ? postersQuery.data?.[tmdbId] : undefined;
    return {
      id: tmdbId ? String(tmdbId) : `${m.title}-${i}`,
      title: m.title,
      subtitle: m.year ? String(m.year) : undefined,
      imageUrl: info?.posterPath ? `${TMDB_IMAGE}${info.posterPath}` : undefined,
      status: info ? tmdbStatus(info) : undefined,
      overseerrDetail: tmdbId !== undefined ? { mediaType, tmdbId } : undefined,
      to: { serviceId: 'overseerr' },
    };
  });

  return {
    items,
    isLoading: listQuery.isLoading || (!!overseerr && tmdbIds.length > 0 && postersQuery.isLoading),
    error: proxyError(listQuery.data),
  };
}

type TautulliMetadataResponse = { response?: { result: string; data?: { guid?: string; guids?: (string | { id: string })[] } } };

// Tautulli mirrors Plex's own agent GUIDs, which come in two shapes depending on how old the
// library metadata is: the modern multi-agent `guids` array with entries like "tmdb://12345",
// or the legacy single `guid` string from the old themoviedb agent,
// "com.plexapp.agents.themoviedb://12345?lang=en". Neither is verified against a live Tautulli
// instance in this session — if the shape has changed, this just yields no seed and the widget
// hides rather than showing something wrong.
function parseTmdbId(guid?: string): number | undefined {
  const m = guid?.match(/(?:tmdb|themoviedb):\/\/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

function extractTmdbId(meta?: TautulliMetadataResponse['response']): number | undefined {
  const data = meta?.data;
  if (!data) return undefined;
  const fromGuids = (data.guids ?? []).map((g) => parseTmdbId(typeof g === 'string' ? g : g.id)).find((id): id is number => id !== undefined);
  return fromGuids ?? parseTmdbId(data.guid);
}

export type TautulliUser = { user_id: number; username: string; friendly_name?: string; is_active?: number };
type TautulliUsersResponse = { response?: { result: string; data?: TautulliUser[] } };

/** Plex users on the server, for the "Because you watched" widget's per-user filter. */
export function useTautulliUsers(tautulli: ServiceInstance | undefined) {
  const { data } = useServiceProxy<TautulliUsersResponse>(tautulli, {
    path: '/api/v2',
    query: { cmd: 'get_users' },
    refetchInterval: false,
    enabled: !!tautulli,
  });
  const users = data?.ok ? data.data?.response?.data ?? [] : [];
  return users.filter((u) => u.is_active !== 0);
}

const REC_SEED_COUNT = 3;
const REC_LIMIT = 30;
export const REC_REFRESH_LIMITS = { min: 60, max: 1440 };

function clampRecRefreshMinutes(minutes: number): number {
  return Math.min(REC_REFRESH_LIMITS.max, Math.max(REC_REFRESH_LIMITS.min, minutes));
}

type RecSeed = { mediaType: 'movie' | 'tv'; ratingKey: string; title: string };

// "Because you watched X" — we don't have a standalone recommendation source, so this pulls a
// few of the most recent distinct Plex watches from Tautulli, resolves each to a TMDB id, and
// merges Overseerr's TMDB recommendations for all of them. Needs both Tautulli (for the watch)
// and Overseerr (for the recommendation) configured — with either missing, or if nothing resolves
// to a TMDB id, it just yields no items and the widget disappears rather than showing a broken row.
export function usePlexRecommendationsCarousel(
  tautulli: ServiceInstance | undefined,
  overseerr: ServiceInstance | undefined,
  userId?: string,
  refreshMinutes = 240,
): CarouselResult & { refetch: () => Promise<void> } {
  const ms = clampRecRefreshMinutes(refreshMinutes) * 60_000;
  const historyQuery = useServiceProxy<TautulliHistoryResponse>(tautulli, {
    path: '/api/v2',
    query: { cmd: 'get_history', order_column: 'date', order_dir: 'desc', length: '30', ...(userId ? { user_id: userId } : {}) },
    refetchInterval: ms,
    staleTime: ms,
    enabled: !!tautulli,
  });
  const rawRows = historyQuery.data?.ok ? historyQuery.data.data?.response?.data?.data : undefined;
  const rows = Array.isArray(rawRows) ? rawRows : [];

  const seeds: RecSeed[] = [];
  const seenKeys = new Set<string>();
  for (const r of rows) {
    if (r.media_type !== 'movie' && r.media_type !== 'episode') continue;
    const ratingKey = r.media_type === 'episode' ? r.grandparent_rating_key : r.rating_key;
    if (!ratingKey) continue;
    const key = String(ratingKey);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    seeds.push({
      mediaType: r.media_type === 'episode' ? 'tv' : 'movie',
      ratingKey: key,
      title: (r.media_type === 'episode' ? r.grandparent_title || r.full_title : r.title || r.full_title) ?? 'Untitled',
    });
    if (seeds.length >= REC_SEED_COUNT) break;
  }
  const seedKey = seeds.map((s) => s.ratingKey).join(',');

  // Each per-seed lookup is isolated (one flaky seed shouldn't blank the rest), but that same
  // isolation was silently swallowing a total failure (every seed timing out) into "just show
  // nothing" — indistinguishable from "genuinely no seeds resolved." failCount lets the final
  // result tell those apart and surface a real error instead of the widget quietly vanishing.
  const metadataQuery = useQuery({
    // v2: the cached value's shape changed ({tmdbIds, failCount} instead of a bare Record) — a
    // stale cache entry under the old key crashed on `.tmdbIds` of the old plain-object shape.
    queryKey: ['plex-rec-metadata-v2', tautulli?.id, seedKey],
    queryFn: async () => {
      let failCount = 0;
      const entries = await Promise.all(
        seeds.map(async (s) => {
          try {
            const res = await proxyApi.call<TautulliMetadataResponse>(tautulli!.id, {
              path: '/api/v2',
              query: { cmd: 'get_metadata', rating_key: s.ratingKey },
              timeoutMs: 10_000,
            });
            if (!res.ok) failCount++;
            return [s.ratingKey, res.ok ? extractTmdbId(res.data?.response) : undefined] as const;
          } catch {
            failCount++;
            return [s.ratingKey, undefined] as const;
          }
        }),
      );
      return { tmdbIds: Object.fromEntries(entries) as Record<string, number | undefined>, failCount };
    },
    enabled: !!tautulli && seeds.length > 0,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const metadataFailedCompletely = seeds.length > 0 && metadataQuery.data?.failCount === seeds.length;

  const seedsWithTmdb = seeds
    .map((s) => ({ ...s, tmdbId: metadataQuery.data?.tmdbIds?.[s.ratingKey] }))
    .filter((s): s is RecSeed & { tmdbId: number } => s.tmdbId !== undefined);
  const seedTmdbKey = seedsWithTmdb.map((s) => `${s.mediaType}-${s.tmdbId}`).join(',');

  const recsQuery = useQuery({
    // v2: see metadataQuery above — the cached value's shape changed here too.
    queryKey: ['plex-recommendations-v2', overseerr?.id, seedTmdbKey],
    queryFn: async () => {
      let failCount = 0;
      const entries = await Promise.all(
        seedsWithTmdb.map(async (s) => {
          try {
            const res = await proxyApi.call<OverseerrDiscoverResponse>(overseerr!.id, {
              path: `/api/v1/${s.mediaType}/${s.tmdbId}/recommendations`,
              timeoutMs: 15_000,
            });
            if (!res.ok) failCount++;
            return res.ok ? res.data?.results ?? [] : [];
          } catch {
            failCount++;
            return [];
          }
        }),
      );
      return { results: entries.flat(), failCount };
    },
    enabled: !!overseerr && seedsWithTmdb.length > 0,
    refetchInterval: ms,
    staleTime: ms,
    retry: 1,
  });
  const recsFailedCompletely = seedsWithTmdb.length > 0 && recsQuery.data?.failCount === seedsWithTmdb.length;

  const seedResultKeys = new Set(seedsWithTmdb.map((s) => `${s.mediaType}-${s.tmdbId}`));
  const seen = new Set<string>();
  const deduped: OverseerrDiscoverItem[] = [];
  for (const r of recsQuery.data?.results ?? []) {
    const mediaType = r.mediaType ?? 'movie';
    const key = `${mediaType}-${r.id}`;
    if (seedResultKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  const items: CarouselItem[] = deduped.slice(0, REC_LIMIT).map((r) => {
    const date = r.releaseDate || r.firstAirDate;
    const mediaType = r.mediaType ?? 'movie';
    return {
      id: `${mediaType}-${r.id}`,
      title: r.title ?? r.name ?? 'Untitled',
      subtitle: date ? date.slice(0, 4) : undefined,
      imageUrl: r.posterPath ? `${TMDB_IMAGE}${r.posterPath}` : undefined,
      rating: r.voteAverage ? Math.round(r.voteAverage * 10) / 10 : undefined,
      status: tmdbStatus(r),
      overseerrDetail: { mediaType, tmdbId: r.id },
      to: { serviceId: 'overseerr' },
    };
  });

  return {
    items,
    isLoading: historyQuery.isLoading || (seeds.length > 0 && metadataQuery.isLoading) || (seedsWithTmdb.length > 0 && recsQuery.isLoading),
    error:
      proxyError(historyQuery.data) ||
      (metadataFailedCompletely ? 'Could not look up watched titles' : undefined) ||
      (recsFailedCompletely ? 'Could not fetch recommendations' : undefined),
    seed: seeds[0] ? { title: seeds[0].title, mediaType: seeds[0].mediaType, extraCount: seeds.length - 1 } : undefined,
    refetch: async () => {
      await historyQuery.refetch();
      await metadataQuery.refetch();
      await recsQuery.refetch();
    },
  };
}

// --- Plex (direct) ---
// Built against Plex's long-stable, well-documented REST API (MediaContainer JSON envelope,
// X-Plex-Token auth) but not verified against a live Plex server in this session — no instance
// was available to test against. If a path/field is off, a widget just yields no items rather
// than showing something wrong; report back the actual response shape to fix it.

function plexImageUrl(plex: ServiceInstance | undefined, thumbPath?: string): string | undefined {
  if (!plex || !thumbPath) return undefined;
  return apiUrl(`/api/plex/${plex.id}/image?${new URLSearchParams({ path: thumbPath })}`);
}

type PlexMetadataItem = {
  ratingKey: string;
  type: 'movie' | 'episode' | 'season' | 'show';
  title: string;
  grandparentTitle?: string;
  year?: number;
  thumb?: string;
  grandparentThumb?: string;
  index?: number;
  parentIndex?: number;
};
type PlexDirectory = { key: string; title: string; type: string };
type PlexCollectionItem = { ratingKey: string; title: string; thumb?: string; childCount?: string };
type PlexContainerResponse<T> = { MediaContainer?: { Metadata?: T[]; Directory?: PlexDirectory[]; size?: number; totalSize?: number } };

export function usePlexRecentlyAddedCarousel(plex: ServiceInstance | undefined): CarouselResult {
  const { data, isLoading, refetch } = useServiceProxy<PlexContainerResponse<PlexMetadataItem>>(plex, {
    path: '/library/recentlyAdded',
    query: { 'X-Plex-Container-Size': String(LIMIT) },
    ...refreshSchedule(plex),
  });
  const rows = data?.ok ? data.data?.MediaContainer?.Metadata ?? [] : [];
  const items: CarouselItem[] = rows.slice(0, LIMIT).map((r) => {
    const isEpisode = r.type === 'episode';
    const thumb = isEpisode ? r.grandparentThumb || r.thumb : r.thumb;
    const subtitle = isEpisode
      ? r.parentIndex !== undefined && r.index !== undefined
        ? `S${r.parentIndex}E${String(r.index).padStart(2, '0')}`
        : undefined
      : r.year
        ? String(r.year)
        : undefined;
    return {
      id: r.ratingKey,
      title: isEpisode ? r.grandparentTitle || r.title : r.title,
      subtitle,
      imageUrl: plexImageUrl(plex, thumb),
      to: { serviceId: 'plex' },
    };
  });
  return { items, isLoading, error: proxyError(data), refetch: async () => void (await refetch()) };
}

export function usePlexCollectionsCarousel(plex: ServiceInstance | undefined): CarouselResult {
  const sectionsQuery = useServiceProxy<PlexContainerResponse<never>>(plex, {
    path: '/library/sections',
    refetchInterval: false,
    enabled: !!plex,
  });
  const sections = (sectionsQuery.data?.ok ? sectionsQuery.data.data?.MediaContainer?.Directory ?? [] : []).filter(
    (s) => s.type === 'movie' || s.type === 'show',
  );
  const sectionKey = sections.map((s) => s.key).join(',');

  const collectionsQuery = useQuery({
    queryKey: ['plex-collections', plex?.id, sectionKey],
    queryFn: async () => {
      const perSection = await mapWithConcurrency(sections, 4, async (s) => {
        try {
          const res = await proxyApi.call<PlexContainerResponse<PlexCollectionItem>>(plex!.id, {
            path: `/library/sections/${s.key}/collections`,
            timeoutMs: 10_000,
          });
          return res.ok ? res.data?.MediaContainer?.Metadata ?? [] : [];
        } catch {
          return [];
        }
      });
      return perSection.flat();
    },
    enabled: !!plex && sections.length > 0,
    ...refreshSchedule(plex),
    retry: 1,
  });

  const items: CarouselItem[] = (collectionsQuery.data ?? []).slice(0, LIMIT).map((c) => ({
    id: c.ratingKey,
    title: c.title,
    subtitle: c.childCount ? `${c.childCount} items` : undefined,
    imageUrl: plexImageUrl(plex, c.thumb),
    to: { serviceId: 'plex' },
  }));

  return {
    items,
    isLoading: sectionsQuery.isLoading || (sections.length > 0 && collectionsQuery.isLoading),
    error: proxyError(sectionsQuery.data),
    refetch: async () => {
      await sectionsQuery.refetch();
      await collectionsQuery.refetch();
    },
  };
}

export type LibraryStat = { key: string; title: string; type: string; count: number };
export type LibraryStatsResult = { stats: LibraryStat[]; isLoading: boolean; error?: string; refetch: () => Promise<void> };

export function usePlexLibraryStats(plex: ServiceInstance | undefined): LibraryStatsResult {
  const sectionsQuery = useServiceProxy<PlexContainerResponse<never>>(plex, {
    path: '/library/sections',
    ...refreshSchedule(plex),
  });
  const sections = sectionsQuery.data?.ok ? sectionsQuery.data.data?.MediaContainer?.Directory ?? [] : [];
  const sectionKey = sections.map((s) => s.key).join(',');

  const countsQuery = useQuery({
    queryKey: ['plex-library-counts', plex?.id, sectionKey],
    queryFn: async () => {
      return mapWithConcurrency(sections, 4, async (s) => {
        try {
          const res = await proxyApi.call<PlexContainerResponse<never>>(plex!.id, {
            path: `/library/sections/${s.key}/all`,
            query: { 'X-Plex-Container-Start': '0', 'X-Plex-Container-Size': '0' },
            timeoutMs: 10_000,
          });
          const count = res.ok ? (res.data?.MediaContainer?.totalSize ?? res.data?.MediaContainer?.size ?? 0) : 0;
          return { key: s.key, title: s.title, type: s.type, count };
        } catch {
          return { key: s.key, title: s.title, type: s.type, count: 0 };
        }
      });
    },
    enabled: !!plex && sections.length > 0,
    ...refreshSchedule(plex),
    retry: 1,
  });

  return {
    stats: countsQuery.data ?? [],
    isLoading: sectionsQuery.isLoading || (sections.length > 0 && countsQuery.isLoading),
    error: proxyError(sectionsQuery.data),
    refetch: async () => {
      await sectionsQuery.refetch();
      await countsQuery.refetch();
    },
  };
}
