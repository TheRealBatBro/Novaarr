import { useMemo, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Loader2, Clapperboard, Tv } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useUiStore } from '@/stores/useUiStore';
import { useVisibleServices } from '@/lib/visibility';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useServiceProxy, useServices } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type ContentResult = { kind: 'movie' | 'series'; id: number; title: string; year?: number; posterUrl?: string };
type LibraryItem = { id: number; title: string; year?: number; images?: { coverType: string; remoteUrl?: string; url?: string }[] };

function posterFor(item: LibraryItem): string | undefined {
  const img = item.images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

// Reuses the exact same query (path, no params) that the Radarr/Sonarr library grids already
// fetch on a 60s poll — same query key, so this rides their cache instead of a fresh request,
// and searches the titles you actually have rather than Radarr/Sonarr's own TMDB/TVDB "lookup"
// endpoint (meant for adding new titles, and unreliable at telling an already-added match apart
// from an unrelated same-titled result).
function useContentSearch(query: string, radarr: ServiceInstance | undefined, sonarr: ServiceInstance | undefined) {
  const q = query.trim().toLowerCase();
  const active = q.length >= 2;
  const { data: moviesResp, isLoading: moviesLoading } = useServiceProxy<LibraryItem[]>(radarr, { path: '/api/v3/movie', refetchInterval: 60_000, enabled: !!radarr && active });
  const { data: seriesResp, isLoading: seriesLoading } = useServiceProxy<LibraryItem[]>(sonarr, { path: '/api/v3/series', refetchInterval: 60_000, enabled: !!sonarr && active });

  const results = useMemo<ContentResult[]>(() => {
    if (!active) return [];
    const movies = (moviesResp?.ok ? moviesResp.data ?? [] : []).filter((m) => m.title.toLowerCase().includes(q));
    const series = (seriesResp?.ok ? seriesResp.data ?? [] : []).filter((s) => s.title.toLowerCase().includes(q));
    return [
      ...movies.map((m): ContentResult => ({ kind: 'movie', id: m.id, title: m.title, year: m.year, posterUrl: posterFor(m) })),
      ...series.map((s): ContentResult => ({ kind: 'series', id: s.id, title: s.title, year: s.year, posterUrl: posterFor(s) })),
    ].slice(0, 20);
  }, [active, q, moviesResp, seriesResp]);

  return { results, loading: active && ((!!radarr && moviesLoading) || (!!sonarr && seriesLoading)) };
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
  const radarr = instances.find((i) => i.serviceId === 'radarr');
  const sonarr = instances.find((i) => i.serviceId === 'sonarr');
  const [query, setQuery] = useState('');
  const { results: contentResults, loading: contentLoading } = useContentSearch(paletteOpen ? query : '', radarr, sonarr);

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
    navigate({ to: '/service/$serviceId/title/$itemId', params: { serviceId: item.kind === 'movie' ? 'radarr' : 'sonarr', itemId: String(item.id) } });
  }

  return (
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
            {contentLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && contentResults.length === 0 && !contentLoading && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
            )}
            {results.map(({ def, instance }) => {
              const Icon = getServiceIcon(def.id);
              return (
                <button
                  key={def.id}
                  onClick={() => select(def.id)}
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
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
