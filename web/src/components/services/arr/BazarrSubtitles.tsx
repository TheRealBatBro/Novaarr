import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wand2, Captions, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy, useServices } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';

// Bazarr's exact write-endpoint contract (POST /api/providers/{episodes,movies} body fields,
// POST /api/{episodes,movies}/subtitles for blind auto-search) is reconstructed from its public
// API conventions, not confirmed against a live instance — the GET endpoints below (list +
// manual-search) ARE confirmed live. If a download/auto-search call fails, the toast will show
// Bazarr's real error message; report it back so the body shape can be corrected.

export function useBazarrInstance(): ServiceInstance | undefined {
  const { data: instances = [] } = useServices();
  return instances.find((i) => i.serviceId === 'bazarr');
}

export type BazarrTrack = { name: string; code2: string; code3: string; forced: boolean; hi: boolean };
export type BazarrEpisodeSubtitleInfo = { missing: BazarrTrack[]; subtitles: BazarrTrack[] };
type RawEpisode = { sonarrEpisodeId?: number; missing_subtitles?: BazarrTrack[]; subtitles?: BazarrTrack[] };
type RawMovie = { radarrId?: number; missing_subtitles?: BazarrTrack[]; subtitles?: BazarrTrack[] };

function unwrapList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (Array.isArray((raw as { data?: unknown })?.data)) return (raw as { data: T[] }).data;
  return [];
}

/** Per-episode subtitle status for a whole series, keyed by sonarrEpisodeId. */
export function useBazarrSeriesSubtitles(seriesId: number): Record<number, BazarrEpisodeSubtitleInfo> {
  const bazarr = useBazarrInstance();
  const { data } = useServiceProxy<unknown>(bazarr, {
    path: '/api/episodes',
    query: { 'seriesid[]': String(seriesId) },
    refetchInterval: false,
    enabled: !!bazarr,
  });
  if (!data?.ok) return {};
  const map: Record<number, BazarrEpisodeSubtitleInfo> = {};
  for (const ep of unwrapList<RawEpisode>(data.data)) {
    if (typeof ep?.sonarrEpisodeId === 'number') {
      map[ep.sonarrEpisodeId] = { missing: ep.missing_subtitles ?? [], subtitles: ep.subtitles ?? [] };
    }
  }
  return map;
}

/** Subtitle status for a single movie. */
export function useBazarrMovieSubtitles(radarrId: number): BazarrEpisodeSubtitleInfo | undefined {
  const bazarr = useBazarrInstance();
  const { data } = useServiceProxy<unknown>(bazarr, {
    path: '/api/movies',
    query: { 'radarrid[]': String(radarrId) },
    refetchInterval: false,
    enabled: !!bazarr,
  });
  if (!data?.ok) return undefined;
  const movie = unwrapList<RawMovie>(data.data).find((m) => m.radarrId === radarrId);
  if (!movie) return undefined;
  return { missing: movie.missing_subtitles ?? [], subtitles: movie.subtitles ?? [] };
}

export function SubtitleLanguageChips({ info }: { info: BazarrEpisodeSubtitleInfo | undefined }) {
  if (!info) return null;
  if (info.missing.length === 0 && info.subtitles.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {info.subtitles.map((s, i) => (
        <span key={`have-${i}`} className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success" title={s.name}>
          {s.code2.toUpperCase()}
          {s.forced ? ' (F)' : ''}
          {s.hi ? ' (HI)' : ''}
        </span>
      ))}
      {info.missing.map((s, i) => (
        <span key={`missing-${i}`} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={`${s.name} missing`}>
          {s.code2.toUpperCase()}
          {s.forced ? ' (F)' : ''}
          {s.hi ? ' (HI)' : ''}
        </span>
      ))}
    </div>
  );
}

// --- Search / download ---

type SearchResult = {
  provider: string;
  subtitle: string;
  language: string;
  forced: string | boolean;
  hearing_impaired: string | boolean;
  original_format?: string | boolean;
  score: number;
  release_info?: string[];
  matches?: string[];
  dont_matches?: string[];
};

type SubtitleTarget = { kind: 'episode'; episodeId: number; seriesId: number } | { kind: 'movie'; radarrId: number };

function truthy(v: string | boolean): boolean {
  return v === true || v === 'True';
}

// Bazarr's write endpoints expect Python-style "True"/"False" string literals for these flags
// (confirmed live: a JSON boolean is silently wrong and a missing original_format is rejected
// outright with "Input payload validation failed"), not JSON booleans.
function pyBool(v: string | boolean | undefined): 'True' | 'False' {
  return truthy(v ?? false) ? 'True' : 'False';
}

function useBazarrSearchResults(bazarr: ServiceInstance | undefined, target: SubtitleTarget | null) {
  return useServiceProxy<{ data?: SearchResult[] } | SearchResult[]>(bazarr, {
    path: target?.kind === 'movie' ? '/api/providers/movies' : '/api/providers/episodes',
    query: target ? (target.kind === 'movie' ? { radarrid: String(target.radarrId) } : { episodeid: String(target.episodeId) }) : undefined,
    // Bazarr fans out to every enabled subtitle provider (opensubtitles.com, etc.) — much
    // slower than a typical Sonarr/Radarr call, so this needs the proxy's near-maximum timeout.
    timeoutMs: 28_000,
    refetchInterval: false,
    enabled: !!bazarr && !!target,
  });
}

function useBazarrDownload(bazarr: ServiceInstance | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { target: SubtitleTarget; result: SearchResult }) => {
      const { target, result } = vars;
      const shared = {
        provider: result.provider,
        subtitle: result.subtitle,
        language: result.language,
        forced: pyBool(result.forced),
        hi: pyBool(result.hearing_impaired),
        original_format: pyBool(result.original_format),
      };
      const body = target.kind === 'movie' ? { radarrid: target.radarrId, ...shared } : { seriesid: target.seriesId, episodeid: target.episodeId, ...shared };
      return proxyApi.call(bazarr!.id, { path: target.kind === 'movie' ? '/api/providers/movies' : '/api/providers/episodes', method: 'POST', body });
    },
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Download failed');
      toast.success('Subtitle downloaded');
      qc.invalidateQueries({ queryKey: ['proxy', bazarr?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Download failed'),
  });
}

// Blind/automatic search-and-download, confirmed live: PATCH (not POST — POST on this same path
// is actually manual file upload) /api/{episodes,movies}/subtitles, one call per target language
// (the endpoint has no "search everything missing" mode), body needs language/forced/hi as
// Python-style "True"/"False" strings. A 204 with no new file means the search genuinely found
// no match for that language, not a failure.
export function useBazarrAutoSearch(bazarr: ServiceInstance | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, missing }: { target: SubtitleTarget; missing: BazarrTrack[] }) => {
      let ok = 0;
      for (const m of missing) {
        const body = {
          language: m.code2,
          forced: m.forced ? 'True' : 'False',
          hi: m.hi ? 'True' : 'False',
          ...(target.kind === 'movie' ? { radarrid: target.radarrId } : { seriesid: target.seriesId, episodeid: target.episodeId }),
        };
        const res = await proxyApi.call(bazarr!.id, {
          path: target.kind === 'movie' ? '/api/movies/subtitles' : '/api/episodes/subtitles',
          method: 'PATCH',
          body,
          timeoutMs: 28_000,
        });
        if (res.ok) ok++;
      }
      return { ok, total: missing.length };
    },
    onSuccess: ({ ok, total }) => {
      toast.success(total > 1 ? `Subtitle search completed (${ok}/${total} languages)` : 'Subtitle search completed');
      qc.invalidateQueries({ queryKey: ['proxy', bazarr?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Search failed'),
  });
}

function ManualSearchResults({ bazarr, target }: { bazarr: ServiceInstance; target: SubtitleTarget }) {
  const { data, isLoading } = useBazarrSearchResults(bazarr, target);
  const download = useBazarrDownload(bazarr);

  if (isLoading) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data?.ok) {
    return <p className="text-sm text-muted-foreground">{data?.error || 'Search failed.'}</p>;
  }

  const results = unwrapList<SearchResult>(data.data);
  if (results.length === 0) return <p className="text-sm text-muted-foreground">No subtitles found.</p>;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {results.map((r, i) => {
        const busy = download.isPending && download.variables?.result === r;
        return (
          <div key={i} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{r.language.toUpperCase()}</span>
                {truthy(r.forced) && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Forced</span>}
                {truthy(r.hearing_impaired) && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">HI</span>}
                <span className="text-xs font-medium text-muted-foreground">{r.provider}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{r.score}%</span>
              </div>
              {r.release_info?.[0] && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.release_info[0]}</p>}
            </div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => download.mutate({ target, result: r })} className="shrink-0">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function BazarrManualSearchDialog({ bazarr, target, title, onClose }: { bazarr: ServiceInstance; target: SubtitleTarget; title: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Subtitles — {title}</DialogTitle>
          <DialogDescription>Pick a result to download.</DialogDescription>
        </DialogHeader>
        <ManualSearchResults bazarr={bazarr} target={target} />
      </DialogContent>
    </Dialog>
  );
}

/** Compact inline auto/manual subtitle controls — used on episode rows and movie detail pages. */
export function BazarrSubtitleControls({
  bazarr,
  target,
  missing,
  title,
  size = 'sm',
}: {
  bazarr: ServiceInstance;
  target: SubtitleTarget;
  missing: BazarrTrack[];
  title: string;
  size?: 'sm' | 'md';
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const autoSearch = useBazarrAutoSearch(bazarr);
  const btnClass = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={btnClass}
        disabled={autoSearch.isPending || missing.length === 0}
        onClick={() => autoSearch.mutate({ target, missing })}
        aria-label="Auto-search subtitles"
        title={missing.length === 0 ? 'No missing subtitles' : 'Auto-search subtitles'}
      >
        {autoSearch.isPending ? <Loader2 className={cn(iconClass, 'animate-spin')} /> : <Wand2 className={iconClass} />}
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => setDialogOpen(true)} aria-label="Search subtitles manually" title="Manual subtitle search">
        <Captions className={iconClass} />
      </Button>
      {dialogOpen && <BazarrManualSearchDialog bazarr={bazarr} target={target} title={title} onClose={() => setDialogOpen(false)} />}
    </>
  );
}

/** Bulk auto-search across every episode in a season — Bazarr has no dedicated season endpoint,
 * so this loops the per-episode, per-missing-language auto-search sequentially and reports a
 * summary toast. */
export function useBazarrSeasonAutoSearch(bazarr: ServiceInstance | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seriesId, episodes }: { seriesId: number; episodes: { episodeId: number; missing: BazarrTrack[] }[] }) => {
      let ok = 0;
      let total = 0;
      for (const { episodeId, missing } of episodes) {
        for (const m of missing) {
          total++;
          const res = await proxyApi.call(bazarr!.id, {
            path: '/api/episodes/subtitles',
            method: 'PATCH',
            body: { seriesid: seriesId, episodeid: episodeId, language: m.code2, forced: m.forced ? 'True' : 'False', hi: m.hi ? 'True' : 'False' },
            timeoutMs: 28_000,
          });
          if (res.ok) ok++;
        }
      }
      return { ok, total };
    },
    onSuccess: ({ ok, total }) => {
      if (total === 0) return toast('No missing subtitles for this season');
      toast.success(`Subtitle search completed (${ok}/${total})`);
      qc.invalidateQueries({ queryKey: ['proxy', bazarr?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Search failed'),
  });
}

// Bazarr's wanted endpoints return `{ data: [...], total: N }` — `total` reflects the real
// count across all pages, so a small page-size request is enough to get the number without
// pulling every wanted item down.
type WantedResponse = { data?: unknown[]; total?: number } | unknown[];

function wantedCount(raw: WantedResponse | undefined): number {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  return raw.total ?? (raw.data?.length ?? 0);
}

/** Total items with at least one missing subtitle language, across movies and series combined. */
export function useBazarrWantedCount(bazarr: ServiceInstance | undefined) {
  const episodes = useServiceProxy<WantedResponse>(bazarr, {
    path: '/api/episodes/wanted',
    query: { length: '1' },
    refetchInterval: 300_000,
    enabled: !!bazarr,
  });
  const movies = useServiceProxy<WantedResponse>(bazarr, {
    path: '/api/movies/wanted',
    query: { length: '1' },
    refetchInterval: 300_000,
    enabled: !!bazarr,
  });
  const ok = !!episodes.data?.ok && !!movies.data?.ok;
  const count = ok ? wantedCount(episodes.data!.data) + wantedCount(movies.data!.data) : undefined;
  return { count, isLoading: episodes.isLoading || movies.isLoading, ok };
}

export type { SubtitleTarget };
