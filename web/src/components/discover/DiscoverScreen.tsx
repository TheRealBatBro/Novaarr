import { useState } from 'react';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useServices } from '@/lib/queries';
import { proxyApi } from '@/lib/api';
import { TMDB_IMAGE, type OverseerrSearchResult } from '@/components/services/overseerr/OverseerrSearch';
import { OverseerrRequestDialog } from '@/components/services/overseerr/OverseerrRequestDialog';
import {
  GENRE_PICKS,
  LANGUAGE_PICKS,
  MOODS,
  OCCASIONS,
  INTEREST_PICKS,
  MAX_RELAX_LEVEL,
  MIN_VOTES_FOR_PROPER_PRODUCTION,
  buildDiscoverParams,
  matchesEra,
  interestMatchScore,
  type Era,
  type Popularity,
} from '@/lib/discoverMoods';

type Step = 'form' | 'loading' | 'results';

// How many picks each results section targets.
const RESULT_TARGET = 6;

type DiscoverItem = OverseerrSearchResult & {
  overview?: string;
  voteAverage?: number;
  voteCount?: number;
  releaseDate?: string;
  firstAirDate?: string;
  originalLanguage?: string;
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

  const [step, setStep] = useState<Step>('form');
  const [moodId, setMoodId] = useState<string | null>(null);
  const [occasionId, setOccasionId] = useState<string | null>(null);
  const [genres, setGenres] = useState<Set<number>>(new Set());
  const [era, setEra] = useState<Era>('any');
  const [popularity, setPopularity] = useState<Popularity>('any');
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState('en');
  const [skipHomemade, setSkipHomemade] = useState(true);
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [movies, setMovies] = useState<DiscoverItem[]>([]);
  const [shows, setShows] = useState<DiscoverItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openRequest, setOpenRequest] = useState<DiscoverItem | null>(null);
  const [relaxedNote, setRelaxedNote] = useState(false);

  const mood = MOODS.find((m) => m.id === moodId);

  function toggleGenre(movieId: number) {
    setGenres((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  }

  function toggleInterest(label: string) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function reset() {
    setStep('form');
    setMoodId(null);
    setOccasionId(null);
    setGenres(new Set());
    setEra('any');
    setPopularity('any');
    setInterests(new Set());
    setLanguage('en');
    setSkipHomemade(true);
    setFamilyFriendly(false);
    setMovies([]);
    setShows([]);
    setError(null);
    setRelaxedNote(false);
  }

  async function runSearch() {
    if (!overseerr || !mood) return;
    setStep('loading');
    setError(null);
    try {
      const watchedKeys = await fetchWatchedTitleKeys(tautulli?.id, tracearr?.id);
      const explicitMovieGenres = GENRE_PICKS.filter((g) => genres.has(g.movieId)).map((g) => g.movieId);
      const explicitTvGenres = GENRE_PICKS.filter((g) => genres.has(g.movieId)).map((g) => g.tvId);
      const selectedInterests = INTEREST_PICKS.filter((p) => interests.has(p.label));
      // Extra interests never filter results out (that risks the same "zero results" trap
      // genre/era once had) — they only re-rank an already-fetched pool, so when any are
      // selected the pool needs to be wider than the final target to have something to sort.
      const candidatePool = selectedInterests.length > 0 ? RESULT_TARGET * 3 : RESULT_TARGET;

      async function collect(mediaType: 'movie' | 'tv', explicitGenres: number[]): Promise<{ picked: DiscoverItem[]; lastError?: string; relaxed: boolean }> {
        const picked: DiscoverItem[] = [];
        const seen = new Set<number>();
        let lastError: string | undefined;
        let anySucceeded = false;
        let relaxed = false;

        // A narrow combination (recent-only + a mood's high rating floor + "popular hits"'
        // vote-count floor) can genuinely have very few matches — a brand-new movie rarely has
        // both a 7+ average and 500+ votes yet. Each relax level drops the next most
        // restrictive constraint instead of just reporting "nothing matched."
        for (let relaxLevel = 0; relaxLevel <= MAX_RELAX_LEVEL && picked.length < candidatePool; relaxLevel++) {
          if (relaxLevel > 0) relaxed = true;
          for (let page = 1; page <= 2 && picked.length < candidatePool; page++) {
            const params = buildDiscoverParams({
              mediaType,
              mood: mood!,
              explicitGenres,
              era,
              language,
              skipHomemade,
              familyFriendly,
              page,
              relaxLevel,
            });
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
              // Client-side backstop for era/language/homemade/rating — belt-and-suspenders
              // alongside the query params above, since none of them depend on trusting an
              // unverified Overseerr param name (era in particular has been observed being
              // silently ignored server-side for TV), and each still relaxes at the same level
              // its query param stops being sent.
              if (relaxLevel < 4 && !matchesEra(era, r.releaseDate ?? r.firstAirDate)) continue;
              if (relaxLevel < 3 && language !== 'any' && r.originalLanguage && r.originalLanguage !== language) continue;
              if (relaxLevel < 2 && skipHomemade && (r.voteCount ?? 0) < MIN_VOTES_FOR_PROPER_PRODUCTION) continue;
              if (relaxLevel < 2 && r.voteAverage !== undefined && r.voteAverage < (familyFriendly ? Math.max(mood!.voteAverageGte, 6.5) : mood!.voteAverageGte)) continue;
              if (relaxLevel < 1) {
                if (popularity === 'hidden-gem' && (r.voteCount ?? 0) > 3000) continue;
                if (popularity === 'popular' && (r.voteCount ?? 0) < 500) continue;
              }
              picked.push(r);
              if (picked.length >= candidatePool) break;
            }
          }
        }

        // Re-rank by extra-interest match (title+overview), stable sort so ties keep the
        // mood's own sort order, then trim down to the actual target.
        if (selectedInterests.length > 0) {
          picked.sort(
            (a, b) =>
              interestMatchScore(`${b.title ?? b.name ?? ''} ${b.overview ?? ''}`, selectedInterests) -
              interestMatchScore(`${a.title ?? a.name ?? ''} ${a.overview ?? ''}`, selectedInterests),
          );
        }

        return { picked: picked.slice(0, RESULT_TARGET), lastError: anySucceeded ? undefined : lastError, relaxed };
      }

      const [movieResult, tvResult] = await Promise.all([collect('movie', explicitMovieGenres), collect('tv', explicitTvGenres)]);
      const firstError = movieResult.lastError || tvResult.lastError;
      if (firstError && movieResult.picked.length === 0 && tvResult.picked.length === 0) {
        setError(`Couldn't reach Seerr — ${firstError}`);
        setStep('form');
        return;
      }
      setMovies(movieResult.picked);
      setShows(tvResult.picked);
      setRelaxedNote(movieResult.relaxed || tvResult.relaxed);
      setStep('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStep('form');
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
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">What should I watch?</h1>
          <p className="text-sm text-muted-foreground">Answer a few questions for six movie and six show picks.</p>
          <p className="text-xs text-muted-foreground">
            Skips anything already in your library, plus watched history from{' '}
            {[tautulli && 'Tautulli', tracearr && 'Tracearr'].filter(Boolean).join(' and ') || 'nothing configured — add Tautulli or Tracearr for that'}.
          </p>
        </div>
      </div>

      {step === 'form' && (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold">What are you in the mood for?</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMoodId(m.id)}
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

            <div>
              <p className="mb-3 text-sm font-semibold">What's the occasion?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {OCCASIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOccasionId(o.id);
                      setFamilyFriendly(o.defaultFamilyFriendly);
                    }}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                      occasionId === o.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-accent',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

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

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold">How old would you like it to be?</p>
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
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold">Anything else you're after? (optional)</p>
            <p className="mb-3 text-xs text-muted-foreground">You can pick as many as you like without risking empty results — these just nudge matching picks higher.</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_PICKS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => toggleInterest(p.label)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    interests.has(p.label) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <p className="mb-3 text-sm font-semibold">Language</p>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="any">Any language</option>
                {LANGUAGE_PICKS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">Skip obscure/homemade titles</p>
                <p className="text-xs text-muted-foreground">Only real, well-tracked productions</p>
              </div>
              <Switch checked={skipHomemade} onCheckedChange={setSkipHomemade} />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">Family-friendly only</p>
                <p className="text-xs text-muted-foreground">Excludes horror, thriller, crime, war</p>
              </div>
              <Switch checked={familyFriendly} onCheckedChange={setFamilyFriendly} />
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button disabled={!mood} onClick={runSearch}>
            Get recommendations
          </Button>
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
          {relaxedNote && (
            <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
              Your exact filters turned up too few picks, so some were loosened (popularity, then rating, then genre/language, and era only
              as a last resort) to still get you six of each.
            </p>
          )}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
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
