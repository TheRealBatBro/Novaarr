import { useQuery } from '@tanstack/react-query';
import { useServiceProxy } from './queries';
import { apiUrl, proxyApi, type ProxyResponse, type ServiceInstance } from './api';

export type WidgetSource = 'sonarr' | 'radarr' | 'overseerr' | 'trakt' | 'sabnzbd' | 'tautulli' | 'tracearr';

export type WidgetDef = {
  key: string;
  title: string;
  source: WidgetSource;
  /** 'carousel' (default) renders a poster row; 'status' renders a compact live-stats card;
   * 'search' renders a compact search box that opens the request dialog on a result tap;
   * 'violations' renders Tracearr's recent-unacknowledged-violations list. */
  kind?: 'carousel' | 'status' | 'search' | 'violations';
};

// NZB360's dashboard sources trending/anticipated lists from Trakt and TMDB directly. We don't
// have a standalone TMDB integration, so Trakt list items (which carry a tmdb id but no artwork)
// get their poster art via Overseerr's own TMDB-backed movie/tv detail endpoints when available.
export const WIDGET_CATALOG: WidgetDef[] = [
  { key: 'sabnzbd-status', title: 'SABnzbd', source: 'sabnzbd', kind: 'status' },
  { key: 'tautulli-status', title: 'Now Playing', source: 'tautulli', kind: 'status' },
  { key: 'overseerr-search', title: 'Search Seerr', source: 'overseerr', kind: 'search' },
  { key: 'tautulli-recent', title: 'Recently Watched', source: 'tautulli' },
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
  default: { min: 5, max: 720 },
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
export type CarouselResult = { items: CarouselItem[]; isLoading: boolean; error?: string };

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
// 3=processing, 4=partially available, 5=available.
function tmdbStatus(info: { releaseDate?: string; firstAirDate?: string; mediaInfo?: { status?: number } }): PosterStatus {
  const date = info.releaseDate || info.firstAirDate;
  if (isFutureDate(date)) return 'upcoming';
  const s = info.mediaInfo?.status;
  if (s === 5) return 'downloaded';
  if (s === 2 || s === 3 || s === 4) return 'downloading';
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
      const entries = await Promise.all(
        tmdbIds.map(async (id) => {
          // Each lookup is isolated — a single flaky/slow request (more likely on a mobile
          // connection, with 10-15 of these firing in parallel) must not blank out every other
          // poster in the batch just because Promise.all rejects on the first rejection.
          try {
            const res = await proxyApi.call<TmdbPosterInfo>(overseerr!.id, {
              path: `/api/v1/${mediaType}/${id}`,
              timeoutMs: 8000,
            });
            return [id, res.ok ? res.data : undefined] as const;
          } catch {
            return [id, undefined] as const;
          }
        }),
      );
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
