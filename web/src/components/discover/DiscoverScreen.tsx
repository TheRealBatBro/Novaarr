import { useState } from 'react';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useServices } from '@/lib/queries';
import { proxyApi } from '@/lib/api';
import { TMDB_IMAGE, type OverseerrSearchResult } from '@/components/services/overseerr/OverseerrSearch';
import { OverseerrRequestDialog } from '@/components/services/overseerr/OverseerrRequestDialog';
import { GENRE_PICKS, MOODS, buildDiscoverParams, type Era, type Popularity } from '@/lib/discoverMoods';

type Step = 'mood' | 'details' | 'loading' | 'results';

type DiscoverItem = OverseerrSearchResult & {
  overview?: string;
  voteAverage?: number;
  voteCount?: number;
  releaseDate?: string;
  firstAirDate?: string;
};
type DiscoverResponse = { results?: DiscoverItem[] };
type TautulliHistoryEntry = { title?: string; full_title?: string; grandparent_title?: string; year?: string | number; watched_status?: number };
type TautulliHistoryResponse = { response?: { data?: { data?: TautulliHistoryEntry[] } } };
type TracearrHistoryEntry = { mediaTitle?: string; showTitle?: string | null; year?: number | null; watched: boolean };
type TracearrHistoryResponse = { data?: TracearrHistoryEntry[] };

function normalizeKey(title: string, year?: string | number): string {
  return `${title.trim().toLowerCase()}|${year ?? ''}`;
}

// Fetches watched history from Tautulli (Plex) and Tracearr (Emby/Jellyfin) — whichever are
// configured — so results already watched, even ones no longer sitting in the library, get
// filtered out too, not just ones Overseerr still shows as "available." Best-effort: a
// title+year match, not a perfect TMDB-id match, since neither history API exposes TMDB IDs.
async function fetchWatchedTitleKeys(tautulliInstanceId: number | undefined, tracearrInstanceId: number | undefined): Promise<Set<string>> {
  const keys = new Set<string>();

  if (tautulliInstanceId) {
    try {
      const res = await proxyApi.call<TautulliHistoryResponse>(tautulliInstanceId, {
        path: '/api/v2',
        query: { cmd: 'get_history', length: '500', order_column: 'date', order_dir: 'desc' },
      });
      if (res.ok) {
        for (const r of res.data?.response?.data?.data ?? []) {
          if (r.watched_status !== undefined && r.watched_status !== 1) continue;
          const title = r.grandparent_title || r.full_title || r.title;
          if (title) keys.add(normalizeKey(title, r.year));
        }
      }
    } catch {
      // Best-effort — a Tautulli hiccup shouldn't block the whole recommendation.
    }
  }

  if (tracearrInstanceId) {
    try {
      const startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const res = await proxyApi.call<TracearrHistoryResponse>(tracearrInstanceId, {
        path: '/api/v1/public/history',
        query: { pageSize: '500', startDate },
      });
      if (res.ok) {
        for (const r of res.data?.data ?? []) {
          if (!r.watched) continue;
          const title = r.showTitle || r.mediaTitle;
          if (title) keys.add(normalizeKey(title, r.year ?? undefined));
        }
      }
    } catch {
      // Best-effort — a Tracearr hiccup shouldn't block the whole recommendation.
    }
  }

  return keys;
}

async function fetchDiscoverPage(
  overseerrId: number,
  mediaType: 'movie' | 'tv',
  params: Record<string, string>,
): Promise<{ items: DiscoverItem[]; error?: string }> {
  const res = await proxyApi.call<DiscoverResponse>(overseerrId, {
    path: `/api/v1/discover/${mediaType === 'movie' ? 'movies' : 'tv'}`,
    query: params,
  });
  if (!res.ok) return { items: [], error: res.error || `Server returned HTTP ${res.status}` };
  return { items: (res.data?.results ?? []).map((r) => ({ ...r, mediaType })) };
}

const MOOD_ICONS: Record<string, string> = {
  fun: '🎈',
  intense: '🔥',
  scary: '👻',
  feelgood: '☀️',
  mindbending: '🌀',
  nostalgic: '📼',
};

export function DiscoverScreen() {
  const { data: instances = [] } = useServices();
  const overseerr = instances.find((i) => i.serviceId === 'overseerr' && i.enabled);
  const tautulli = instances.find((i) => i.serviceId === 'tautulli' && i.enabled);
  const tracearr = instances.find((i) => i.serviceId === 'tracearr' && i.enabled);

  const [step, setStep] = useState<Step>('mood');
  const [moodId, setMoodId] = useState<string | null>(null);
  const [genres, setGenres] = useState<Set<number>>(new Set());
  const [era, setEra] = useState<Era>('any');
  const [popularity, setPopularity] = useState<Popularity>('any');
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [movies, setMovies] = useState<DiscoverItem[]>([]);
  const [shows, setShows] = useState<DiscoverItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openRequest, setOpenRequest] = useState<DiscoverItem | null>(null);

  const mood = MOODS.find((m) => m.id === moodId);

  function toggleGenre(movieId: number) {
    setGenres((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  }

  function reset() {
    setStep('mood');
    setMoodId(null);
    setGenres(new Set());
    setEra('any');
    setPopularity('any');
    setFamilyFriendly(false);
    setMovies([]);
    setShows([]);
    setError(null);
  }

  async function runSearch() {
    if (!overseerr || !mood) return;
    setStep('loading');
    setError(null);
    try {
      const watchedKeys = await fetchWatchedTitleKeys(tautulli?.id, tracearr?.id);
      const explicitMovieGenres = GENRE_PICKS.filter((g) => genres.has(g.movieId)).map((g) => g.movieId);
      const explicitTvGenres = GENRE_PICKS.filter((g) => genres.has(g.movieId)).map((g) => g.tvId);

      async function collect(mediaType: 'movie' | 'tv', explicitGenres: number[]): Promise<{ picked: DiscoverItem[]; lastError?: string }> {
        const picked: DiscoverItem[] = [];
        const seen = new Set<number>();
        let lastError: string | undefined;
        let anySucceeded = false;
        for (let page = 1; page <= 3 && picked.length < 5; page++) {
          const params = buildDiscoverParams({ mediaType, mood: mood!, explicitGenres, era, familyFriendly, page });
          const { items, error: pageError } = await fetchDiscoverPage(overseerr!.id, mediaType, params);
          if (pageError) {
            lastError = pageError;
            continue;
          }
          anySucceeded = true;
          for (const r of items) {
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            // Already available/requested/processing in your library — Overseerr's own signal
            // for "you already have this," the most reliable exclusion available without a
            // perfect per-user watch-history match.
            if (r.mediaInfo?.status !== undefined) continue;
            const title = r.title ?? r.name ?? '';
            const year = (r.releaseDate ?? r.firstAirDate)?.slice(0, 4);
            if (watchedKeys.has(normalizeKey(title, year))) continue;
            if (popularity === 'hidden-gem' && (r.voteCount ?? 0) > 3000) continue;
            if (popularity === 'popular' && (r.voteCount ?? 0) < 500) continue;
            picked.push(r);
            if (picked.length >= 5) break;
          }
        }
        return { picked, lastError: anySucceeded ? undefined : lastError };
      }

      const [movieResult, tvResult] = await Promise.all([collect('movie', explicitMovieGenres), collect('tv', explicitTvGenres)]);
      const firstError = movieResult.lastError || tvResult.lastError;
      if (firstError && movieResult.picked.length === 0 && tvResult.picked.length === 0) {
        setError(`Couldn't reach Seerr — ${firstError}`);
        setStep('details');
        return;
      }
      setMovies(movieResult.picked);
      setShows(tvResult.picked);
      setStep('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStep('details');
    }
  }

  if (!overseerr) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">Discover needs Seerr configured</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This feature suggests movies and shows using Seerr's own discovery API — add and enable a Seerr instance in
          Settings → Services to use it.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">What should I watch?</h1>
          <p className="text-sm text-muted-foreground">Answer a few questions for five movie and five show picks.</p>
          <p className="text-xs text-muted-foreground">
            Skips anything already in your library, plus watched history from{' '}
            {[tautulli && 'Tautulli', tracearr && 'Tracearr'].filter(Boolean).join(' and ') || 'nothing configured — add Tautulli or Tracearr for that'}.
          </p>
        </div>
      </div>

      {step === 'mood' && (
        <div>
          <p className="mb-3 text-sm font-semibold">What are you in the mood for?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMoodId(m.id);
                  setStep('details');
                }}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors',
                  moodId === m.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent',
                )}
              >
                <span className="text-2xl">{MOOD_ICONS[m.id]}</span>
                <span className="font-semibold">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'details' && mood && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-3 text-sm font-semibold">Any specific genres? (optional — leave blank to let your mood decide)</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_PICKS.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => toggleGenre(g.movieId)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    genres.has(g.movieId) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Era</p>
            <div className="flex gap-2">
              {(
                [
                  ['new', 'New releases'],
                  ['classic', 'Modern classics'],
                  ['any', "Doesn't matter"],
                ] as [Era, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEra(value)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    era === value ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Popularity</p>
            <div className="flex gap-2">
              {(
                [
                  ['popular', 'Popular hits'],
                  ['hidden-gem', 'Hidden gems'],
                  ['any', "Doesn't matter"],
                ] as [Popularity, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPopularity(value)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    popularity === value ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div>
              <p className="text-sm font-medium">Family-friendly only</p>
              <p className="text-xs text-muted-foreground">Excludes horror, thriller, crime, and war picks</p>
            </div>
            <Switch checked={familyFriendly} onCheckedChange={setFamilyFriendly} />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('mood')}>
              Back
            </Button>
            <Button className="flex-1" onClick={runSearch}>
              Get recommendations
            </Button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finding something good…</p>
        </div>
      )}

      {step === 'results' && (
        <div className="flex flex-col gap-8">
          <ResultSection title="Movies" items={movies} onPick={setOpenRequest} />
          <ResultSection title="TV Shows" items={shows} onPick={setOpenRequest} />
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </Button>
        </div>
      )}

      {openRequest && (
        <OverseerrRequestDialog
          instance={overseerr}
          mediaType={openRequest.mediaType === 'tv' ? 'tv' : 'movie'}
          tmdbId={openRequest.id}
          fallbackTitle={openRequest.title ?? openRequest.name ?? 'Untitled'}
          fallbackPoster={openRequest.posterPath ? `${TMDB_IMAGE}${openRequest.posterPath}` : undefined}
          onClose={() => setOpenRequest(null)}
        />
      )}
    </div>
  );
}

function ResultSection({ title, items, onPick }: { title: string; items: DiscoverItem[]; onPick: (item: DiscoverItem) => void }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matched — try loosening a filter and starting over.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {items.map((item) => {
            const displayTitle = item.title ?? item.name ?? 'Untitled';
            const year = (item.releaseDate ?? item.firstAirDate)?.slice(0, 4);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-colors hover:border-primary"
              >
                <div className="aspect-[2/3] w-full overflow-hidden bg-muted">
                  {item.posterPath ? (
                    <img src={`${TMDB_IMAGE}${item.posterPath}`} alt={displayTitle} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{displayTitle}</div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-semibold leading-tight">{displayTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {[year, item.voteAverage ? `★ ${item.voteAverage.toFixed(1)}` : undefined].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
