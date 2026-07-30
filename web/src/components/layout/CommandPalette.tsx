import { useMemo, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Loader2, Clapperboard, Tv, Plus } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useUiStore } from '@/stores/useUiStore';
import { useVisibleServices } from '@/lib/visibility';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useServiceProxyQueries, useServices } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { AddMovieDialog, type MovieLookupResult } from '@/components/services/arr/AddMovieDialog';
import { AddSeriesDialog, type SeriesLookupResult } from '@/components/services/arr/AddSeriesDialog';

type ContentResult = { kind: 'movie' | 'series'; id: number; instanceId: number; title: string; year?: number; posterUrl?: string };
type LibraryItem = { id: number; title: string; year?: number; images?: { coverType: string; remoteUrl?: string; url?: string }[] };
type DiscoveryResult = { kind: 'movie'; item: MovieLookupResult } | { kind: 'series'; item: SeriesLookupResult };

function posterFor(item: { images?: { coverType: string; remoteUrl?: string; url?: string }[] }): string | undefined {
  const img = item.images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

// Radarr/Sonarr's "lookup" endpoints are TMDB/TVDB-backed title search meant for the add-new
// flow — separate from useContentSearch's library search above, and debounced since (unlike the
// cached library list) every keystroke here is a live upstream request.
function useDiscoverySearch(query: string, radarr: ServiceInstance | undefined, sonarr: ServiceInstance | undefined) {
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([
        radarr ? proxyApi.call<MovieLookupResult[]>(radarr.id, { path: '/api/v3/movie/lookup', query: { term: q }, timeoutMs: 12_000 }).catch(() => null) : Promise.resolve(null),
        sonarr ? proxyApi.call<SeriesLookupResult[]>(sonarr.id, { path: '/api/v3/series/lookup', query: { term: q }, timeoutMs: 12_000 }).catch(() => null) : Promise.resolve(null),
      ]).then(([movieRes, seriesRes]) => {
        if (cancelled) return;
        const movies: DiscoveryResult[] = movieRes?.ok ? (movieRes.data ?? []).map((item) => ({ kind: 'movie' as const, item })) : [];
        const series: DiscoveryResult[] = seriesRes?.ok ? (seriesRes.data ?? []).map((item) => ({ kind: 'series' as const, item })) : [];
        setResults([...movies, ...series]);
        setLoading(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, radarr, sonarr]);

  return { results, loading };
}

// Reuses the exact same query (path, no params) that the Radarr/Sonarr library grids already
// fetch on a 60s poll — same query key, so this rides their cache instead of a fresh request,
// and searches the titles you actually have rather than Radarr/Sonarr's own TMDB/TVDB "lookup"
// endpoint (meant for adding new titles, and unreliable at telling an already-added match apart
// from an unrelated same-titled result).
function useContentSearch(query: string, radarrInstances: ServiceInstance[], sonarrInstances: ServiceInstance[]) {
  const q = query.trim().toLowerCase();
  const active = q.length >= 2;
  // useQueries (via useServiceProxyQueries), not useServiceProxy per instance — the instance list
  // is dynamic (0, 1, or more Radarr/Sonarr instances), and React doesn't allow a variable number
  // of hook calls in a loop.
  const movieQueries = useServiceProxyQueries<LibraryItem[]>(radarrInstances, { path: '/api/v3/movie', refetchInterval: 60_000, enabled: active });
  const seriesQueries = useServiceProxyQueries<LibraryItem[]>(sonarrInstances, { path: '/api/v3/series', refetchInterval: 60_000, enabled: active });

  const results = useMemo<ContentResult[]>(() => {
    if (!active) return [];
    const movies = movieQueries.flatMap((res, i) =>
      (res.data?.ok ? res.data.data ?? [] : [])
        .filter((m) => m.title.toLowerCase().includes(q))
        .map((m): ContentResult => ({ kind: 'movie', id: m.id, instanceId: radarrInstances[i].id, title: m.title, year: m.year, posterUrl: posterFor(m) })),
    );
    const series = seriesQueries.flatMap((res, i) =>
      (res.data?.ok ? res.data.data ?? [] : [])
        .filter((s) => s.title.toLowerCase().includes(q))
        .map((s): ContentResult => ({ kind: 'series', id: s.id, instanceId: sonarrInstances[i].id, title: s.title, year: s.year, posterUrl: posterFor(s) })),
    );
    return [...movies, ...series].slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, q, movieQueries, seriesQueries]);

  const loading = active && (movieQueries.some((r) => r.isLoading) || seriesQueries.some((r) => r.isLoading));
  return { results, loading };
}

/** Uses Radix's own data-state-driven CSS animation, not framer-motion's AnimatePresence +
 * forceMount — see AppDrawer.tsx for why that combo can leave a full-screen invisible
 * click-blocking overlay stuck in the DOM when a result selection closes the palette and
 * navigates in the same tick (exactly what `select()` below does). */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const visible = useVisibleServices();
  const { data: instances = [] } = useServices();
  // navAllowed excludes an instance only reachable via an access role's widget grant — search
  // and "add new" are full page-level features, not "a dashboard widget".
  const radarrInstances = instances.filter((i) => i.serviceId === 'radarr' && i.navAllowed);
  const sonarrInstances = instances.filter((i) => i.serviceId === 'sonarr' && i.navAllowed);
  // "Add new" always targets the first configured instance of each — picking which of several
  // Radarr/Sonarr instances to add a brand-new title to isn't exposed here, same as it wasn't
  // before multi-instance existed at all.
  const radarr = radarrInstances[0];
  const sonarr = sonarrInstances[0];
  const [query, setQuery] = useState('');
  const [addMovieCandidate, setAddMovieCandidate] = useState<MovieLookupResult | null>(null);
  const [addSeriesCandidate, setAddSeriesCandidate] = useState<SeriesLookupResult | null>(null);
  const { results: contentResults, loading: contentLoading } = useContentSearch(paletteOpen ? query : '', radarrInstances, sonarrInstances);
  const { results: discoveryResults, loading: discoveryLoading } = useDiscoverySearch(paletteOpen ? query : '', radarr, sonarr);

  const libraryTitles = useMemo(() => new Set(contentResults.map((r) => r.title.toLowerCase())), [contentResults]);
  const newResults = discoveryResults.filter((d) => !libraryTitles.has(d.item.title.toLowerCase())).slice(0, 8);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (!paletteOpen) setQuery('');
  }, [paletteOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = visible.map(({ definition, instance }) => ({ def: definition, instance }));
    if (!q) return base;
    return base.filter(
      ({ def, instance }) => def.displayName.toLowerCase().includes(q) || instance?.displayName.toLowerCase().includes(q),
    );
  }, [query, visible]);

  function select(serviceId: string) {
    setPaletteOpen(false);
    navigate({ to: '/service/$serviceId', params: { serviceId } });
  }

  function selectContent(item: ContentResult) {
    setPaletteOpen(false);
    navigate({ to: '/service/$serviceId/title/$itemId', params: { serviceId: String(item.instanceId), itemId: String(item.id) } });
  }

  function selectDiscovery(d: DiscoveryResult) {
    setPaletteOpen(false);
    if (d.kind === 'movie') setAddMovieCandidate(d.item);
    else setAddSeriesCandidate(d.item);
  }

  const nothingFound = results.length === 0 && contentResults.length === 0 && newResults.length === 0 && !contentLoading && !discoveryLoading;

  return (
    <>
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to a service, or search movies & TV…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {(contentLoading || discoveryLoading) && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {nothingFound && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>}
            {results.map(({ def, instance }) => {
              const Icon = getServiceIcon(def.id);
              return (
                <button
                  key={instance?.id ?? def.id}
                  onClick={() => select(instance ? String(instance.id) : def.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${def.brandColor}22`, color: def.brandColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{instance?.displayName ?? def.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{instance ? def.displayName : 'Not configured'}</p>
                  </div>
                </button>
              );
            })}
            {contentResults.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase text-muted-foreground">Movies &amp; TV</p>
                {contentResults.map((item) => {
                  const Icon = item.kind === 'movie' ? Clapperboard : Tv;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      onClick={() => selectContent(item)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.title} {item.year ? <span className="text-muted-foreground">({item.year})</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{item.kind === 'movie' ? 'Radarr' : 'Sonarr'}</p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
            {newResults.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase text-muted-foreground">Add new</p>
                {newResults.map((d, i) => {
                  const poster = posterFor(d.item);
                  const Icon = d.kind === 'movie' ? Clapperboard : Tv;
                  return (
                    <button
                      key={`new-${d.kind}-${i}`}
                      onClick={() => selectDiscovery(d)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {poster ? <img src={poster} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {d.item.title} {d.item.year ? <span className="text-muted-foreground">({d.item.year})</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">Not in your library — tap to add</p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>

    {addMovieCandidate && radarr && (
      <AddMovieDialog
        instance={radarr}
        open
        onOpenChange={(o) => !o && setAddMovieCandidate(null)}
        initialResult={addMovieCandidate}
        onAdded={() => setAddMovieCandidate(null)}
      />
    )}
    {addSeriesCandidate && sonarr && (
      <AddSeriesDialog
        instance={sonarr}
        open
        onOpenChange={(o) => !o && setAddSeriesCandidate(null)}
        initialResult={addSeriesCandidate}
        onAdded={() => setAddSeriesCandidate(null)}
      />
    )}
    </>
  );
}
