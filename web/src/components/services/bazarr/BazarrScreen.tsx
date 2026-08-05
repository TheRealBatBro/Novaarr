import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { useServiceProxy } from '@/lib/queries';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { unwrapList, BazarrSubtitleControls, type BazarrTrack, type SubtitleTarget } from '@/components/services/arr/BazarrSubtitles';

const Icon = getServiceIcon('bazarr');

const TABS = ['wanted', 'history', 'blacklist', 'providers'] as const;
type Tab = (typeof TABS)[number];

// --- Wanted ---
type WantedMovie = { title: string; missing_subtitles: BazarrTrack[]; radarrId: number; sceneName?: string };
type WantedEpisode = {
  seriesTitle: string;
  episode_number: string;
  episodeTitle: string;
  missing_subtitles: BazarrTrack[];
  sonarrSeriesId: number;
  sonarrEpisodeId: number;
  sceneName?: string;
};
type WantedResponse<T> = { data?: T[]; total?: number } | T[];

// --- History (field names beyond the movie-history shape confirmed in Bazarr's source are
// best-effort — episode history "mirrors" it per Bazarr's own code structure, but the exact
// title/series keys weren't independently confirmed against a live instance) ---
type HistoryRow = {
  id: number;
  action: string;
  title?: string;
  seriesTitle?: string;
  episode_number?: string;
  episodeTitle?: string;
  timestamp: string;
  description?: string;
  radarrId?: number;
  sonarrSeriesId?: number;
  sonarrEpisodeId?: number;
  language?: { name?: string; code2?: string } | string;
  provider?: string;
  subtitles_path?: string;
  score?: number;
};

// --- Blacklist ---
type BlacklistMovieRow = { title: string; radarrId: number; provider: string; subs_id: string; language: string; timestamp: string };
type BlacklistEpisodeRow = {
  seriesTitle: string;
  episode_number: string;
  episodeTitle: string;
  sonarrSeriesId: number;
  provider: string;
  subs_id: string;
  language: string;
  timestamp: string;
};

// --- Providers ---
type ProviderRow = { name: string; status: string; retry?: string };

function languageLabel(l?: { name?: string; code2?: string } | string): string {
  if (!l) return '—';
  if (typeof l === 'string') return l.toUpperCase();
  return l.name ?? l.code2?.toUpperCase() ?? '—';
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}hr ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">{children}</div>;
}

export function BazarrScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('wanted');
  useResetScrollOnChange(tab);

  const { data: statusResp, isLoading: statusLoading } = useServiceProxy<{ bazarr_version?: string }>(instance, {
    path: '/api/system/status',
    refetchInterval: 60_000,
  });
  const status: ServiceStatus = statusLoading ? 'unknown' : statusResp?.ok ? 'online' : 'offline';

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#3e5c7622', color: '#3e5c76' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {statusResp?.ok ? statusResp.data?.bazarr_version ?? 'Connected' : status === 'offline' ? 'Unreachable' : 'Connecting…'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              tab === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'wanted' && <WantedTab instance={instance} />}
      {tab === 'history' && <HistoryTab instance={instance} onSynced={invalidate} />}
      {tab === 'blacklist' && <BlacklistTab instance={instance} />}
      {tab === 'providers' && <ProvidersTab instance={instance} />}
    </div>
  );
}

function WantedTab({ instance }: { instance: ServiceInstance }) {
  const { data: moviesResp, isLoading: moviesLoading } = useServiceProxy<WantedResponse<WantedMovie>>(instance, {
    path: '/api/movies/wanted',
    query: { length: '50' },
    refetchInterval: 60_000,
  });
  const { data: episodesResp, isLoading: episodesLoading } = useServiceProxy<WantedResponse<WantedEpisode>>(instance, {
    path: '/api/episodes/wanted',
    query: { length: '50' },
    refetchInterval: 60_000,
  });

  const movies = moviesResp?.ok ? unwrapList<WantedMovie>(moviesResp.data) : [];
  const episodes = episodesResp?.ok ? unwrapList<WantedEpisode>(episodesResp.data) : [];
  const isLoading = moviesLoading || episodesLoading;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Movies missing subtitles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          {!isLoading && movies.length === 0 && <p className="text-sm text-muted-foreground">Nothing wanted — every movie has its subtitles.</p>}
          {movies.map((m) => (
            <Row key={m.radarrId}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.missing_subtitles.map((s) => s.name).join(', ')}</p>
              </div>
              <BazarrSubtitleControls
                bazarr={instance}
                target={{ kind: 'movie', radarrId: m.radarrId } satisfies SubtitleTarget}
                missing={m.missing_subtitles}
                title={m.title}
              />
            </Row>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Episodes missing subtitles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          {!isLoading && episodes.length === 0 && <p className="text-sm text-muted-foreground">Nothing wanted — every episode has its subtitles.</p>}
          {episodes.map((ep) => (
            <Row key={ep.sonarrEpisodeId}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {ep.seriesTitle} · {ep.episode_number}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {ep.episodeTitle} — {ep.missing_subtitles.map((s) => s.name).join(', ')}
                </p>
              </div>
              <BazarrSubtitleControls
                bazarr={instance}
                target={{ kind: 'episode', episodeId: ep.sonarrEpisodeId, seriesId: ep.sonarrSeriesId } satisfies SubtitleTarget}
                missing={ep.missing_subtitles}
                title={`${ep.seriesTitle} — ${ep.episode_number}`}
              />
            </Row>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Bazarr's subtitle-sync endpoint (confirmed to exist in its API, request shape reconstructed
// from its documented fields — not verified against a live instance). Only offered on history
// rows, since that's the one place a subtitle's file path (`subtitles_path`) is actually
// available; the movie/episode subtitle-status endpoints never expose it.
function useBazarrSync(bazarr: ServiceInstance) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: HistoryRow) =>
      proxyApi.call(bazarr.id, {
        path: '/api/subtitles',
        method: 'PATCH',
        body: {
          action: 'sync',
          language: typeof row.language === 'string' ? row.language : row.language?.code2,
          path: row.subtitles_path,
          type: row.radarrId ? 'movie' : 'episode',
          id: row.radarrId ?? row.sonarrEpisodeId,
        },
        timeoutMs: 28_000,
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Sync failed');
      toast.success('Subtitle synced to the video');
      qc.invalidateQueries({ queryKey: ['proxy', bazarr.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Sync failed'),
  });
}

function HistoryTab({ instance, onSynced }: { instance: ServiceInstance; onSynced: () => void }) {
  const { data: moviesResp, isLoading: moviesLoading } = useServiceProxy<WantedResponse<HistoryRow>>(instance, {
    path: '/api/movies/history',
    query: { length: '50' },
    refetchInterval: 60_000,
  });
  const { data: episodesResp, isLoading: episodesLoading } = useServiceProxy<WantedResponse<HistoryRow>>(instance, {
    path: '/api/episodes/history',
    query: { length: '50' },
    refetchInterval: 60_000,
  });
  const sync = useBazarrSync(instance);

  const rows = [...(moviesResp?.ok ? unwrapList<HistoryRow>(moviesResp.data) : []), ...(episodesResp?.ok ? unwrapList<HistoryRow>(episodesResp.data) : [])].sort(
    (a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''),
  );
  const isLoading = moviesLoading || episodesLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">No subtitle activity yet.</p>}
        {rows.map((row) => {
          const label = row.title ?? (row.seriesTitle ? `${row.seriesTitle} · ${row.episode_number ?? ''}` : 'Unknown');
          const busy = sync.isPending && sync.variables === row;
          const canSync = !!row.subtitles_path && row.action?.toLowerCase() !== 'deleted';
          return (
            <Row key={row.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.action} · {languageLabel(row.language)}
                  {row.provider ? ` · ${row.provider}` : ''} · {relativeTime(row.timestamp)}
                </p>
              </div>
              {canSync && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sync.isPending}
                  onClick={() => sync.mutate(row, { onSuccess: onSynced })}
                  title="Sync this subtitle's timing to the video"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sync
                </Button>
              )}
            </Row>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BlacklistTab({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data: moviesResp, isLoading: moviesLoading } = useServiceProxy<WantedResponse<BlacklistMovieRow>>(instance, {
    path: '/api/movies/blacklist',
    query: { length: '50' },
  });
  const { data: episodesResp, isLoading: episodesLoading } = useServiceProxy<WantedResponse<BlacklistEpisodeRow>>(instance, {
    path: '/api/episodes/blacklist',
    query: { length: '50' },
  });
  const isLoading = moviesLoading || episodesLoading;

  const removeMovie = useMutation({
    mutationFn: (row: BlacklistMovieRow) => proxyApi.call(instance.id, { path: '/api/movies/blacklist', method: 'DELETE', body: { provider: row.provider, subs_id: row.subs_id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to remove');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove'),
  });
  const removeEpisode = useMutation({
    mutationFn: (row: BlacklistEpisodeRow) => proxyApi.call(instance.id, { path: '/api/episodes/blacklist', method: 'DELETE', body: { provider: row.provider, subs_id: row.subs_id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to remove');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove'),
  });

  const movies = moviesResp?.ok ? unwrapList<BlacklistMovieRow>(moviesResp.data) : [];
  const episodes = episodesResp?.ok ? unwrapList<BlacklistEpisodeRow>(episodesResp.data) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blacklist</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        {!isLoading && movies.length === 0 && episodes.length === 0 && <p className="text-sm text-muted-foreground">Nothing blacklisted.</p>}
        {movies.map((row) => (
          <Row key={`m-${row.radarrId}-${row.subs_id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {languageLabel(row.language)} · {row.provider} · {relativeTime(row.timestamp)}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={removeMovie.isPending} onClick={() => removeMovie.mutate(row)} aria-label="Remove from blacklist">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Row>
        ))}
        {episodes.map((row) => (
          <Row key={`e-${row.sonarrSeriesId}-${row.subs_id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {row.seriesTitle} · {row.episode_number}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.episodeTitle} — {languageLabel(row.language)} · {row.provider} · {relativeTime(row.timestamp)}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={removeEpisode.isPending} onClick={() => removeEpisode.mutate(row)} aria-label="Remove from blacklist">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Row>
        ))}
      </CardContent>
    </Card>
  );
}

function ProvidersTab({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading } = useServiceProxy<WantedResponse<ProviderRow>>(instance, { path: '/api/providers', refetchInterval: 30_000 });
  const providers = data?.ok ? unwrapList<ProviderRow>(data.data) : [];

  const reset = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: '/api/providers', method: 'POST', body: { action: 'reset' } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Reset failed');
      toast.success('Provider throttling reset');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Reset failed'),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Providers</CardTitle>
        <Button variant="outline" size="sm" disabled={reset.isPending} onClick={() => reset.mutate()}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset throttling
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        {!isLoading && providers.length === 0 && <p className="text-sm text-muted-foreground">No providers are currently throttled.</p>}
        {providers.map((p) => (
          <Row key={p.name}>
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">
              {p.status}
              {p.retry ? ` · retry ${p.retry}` : ''}
            </span>
          </Row>
        ))}
      </CardContent>
    </Card>
  );
}
