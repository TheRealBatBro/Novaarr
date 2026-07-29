import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { WolButton } from '@/components/shared/WolButton';
import { ArrLibraryGrid } from './ArrLibraryGrid';
import { ArrHistoryScreen } from './ArrHistoryScreen';
import { ArrOverviewScreen } from './ArrOverviewScreen';
import { AddSeriesDialog } from './AddSeriesDialog';
import { AddMovieDialog } from './AddMovieDialog';
import { ArrQueueItemDialog } from './ArrQueueItemDialog';
import { useServiceProxy } from '@/lib/queries';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import type { ServiceDefinition } from '@/lib/serviceRegistry';

// Only Radarr/Sonarr get a Library tab — Lidarr/Readarr's artist/author+album/book
// shape is different enough that it wasn't safe to generalize without a live instance to check.
const LIBRARY_CONFIG: Record<string, { path: string; kind: 'movie' | 'series' }> = {
  radarr: { path: '/api/v3/movie', kind: 'movie' },
  sonarr: { path: '/api/v3/series', kind: 'series' },
};

type ArrQueueRecord = {
  id: number;
  downloadId?: string;
  title: string;
  size: number;
  sizeleft: number;
  timeleft?: string;
  status: string;
  trackedDownloadStatus?: 'ok' | 'warning' | 'error';
  statusMessages?: { title?: string; messages?: string[] }[];
  errorMessage?: string;
  quality?: { quality?: { name?: string } };
  indexer?: string;
  downloadClient?: string;
  series?: { title: string };
  episode?: { title: string; seasonNumber?: number; episodeNumber?: number };
  movie?: { title: string };
  artist?: { artistName: string };
  album?: { title: string };
  author?: { authorName: string };
  book?: { title: string };
};

type ArrQueue = { records?: ArrQueueRecord[] };

function labelFor(rec: ArrQueueRecord): string {
  if (rec.series) return `${rec.series.title} — S${rec.episode?.seasonNumber}E${rec.episode?.episodeNumber}`;
  if (rec.movie) return rec.movie.title;
  if (rec.artist) return `${rec.artist.artistName} — ${rec.album?.title ?? rec.title}`;
  if (rec.author) return `${rec.author.authorName} — ${rec.book?.title ?? rec.title}`;
  return rec.title;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 GB';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

const STATUS_PILL: Record<string, string> = {
  ok: 'bg-success/15 text-success',
  warning: 'bg-amber-500/15 text-amber-500',
  error: 'bg-destructive/15 text-destructive',
};

const TABS = ['library', 'queue', 'history', 'server'] as const;
type Tab = (typeof TABS)[number];

/** Shared queue view for Sonarr/Radarr (/api/v3) and Lidarr/Readarr (/api/v1) — same record shape. */
export function ArrQueueScreen({
  definition,
  instance,
  apiVersion = 'v3',
}: {
  definition: ServiceDefinition;
  instance: ServiceInstance;
  apiVersion?: 'v3' | 'v1';
}) {
  const Icon = getServiceIcon(definition.id);
  const libraryConfig = LIBRARY_CONFIG[definition.id];
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(libraryConfig ? 'library' : 'queue');
  useResetScrollOnChange(tab);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ArrQueueRecord | null>(null);
  const canManage = definition.id === 'sonarr' || definition.id === 'radarr';

  function openDetail(id: number) {
    navigate({ to: '/service/$serviceId/title/$itemId', params: { serviceId: String(instance.id), itemId: String(id) } });
  }
  const { data, isLoading } = useServiceProxy<ArrQueue>(instance, {
    path: `/api/${apiVersion}/queue`,
    query: { includeUnknownMovieItems: 'true', includeUnknownSeriesItems: 'true' },
    refetchInterval: 8000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const records = data?.data?.records ?? [];

  const availableTabs = libraryConfig ? TABS : TABS.filter((t) => t !== 'library' && t !== 'server');

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${definition.brandColor}22`, color: definition.brandColor }}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{status === 'offline' ? 'Unreachable' : 'Download queue'}</p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
      </div>

      <div className="mb-4 flex gap-1.5">
        {availableTabs.map((t) => (
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

      {libraryConfig && tab === 'library' && (
        <ArrLibraryGrid
          instance={instance}
          path={libraryConfig.path}
          kind={libraryConfig.kind}
          onSelect={canManage ? openDetail : undefined}
          onAdd={canManage ? () => setAddOpen(true) : undefined}
        />
      )}

      {tab === 'queue' && (
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            {!isLoading && records.length === 0 && <p className="text-sm text-muted-foreground">Nothing downloading right now.</p>}
            {records.map((rec) => {
              const pct = rec.size > 0 ? ((rec.size - rec.sizeleft) / rec.size) * 100 : 0;
              const pillClass = STATUS_PILL[rec.trackedDownloadStatus ?? ''] ?? 'bg-accent text-muted-foreground';
              const warning = rec.statusMessages?.flatMap((m) => m.messages ?? []).join(' · ') || rec.errorMessage;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedRecord(rec)}
                  className="flex flex-col gap-1.5 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                >
                  <p className="min-w-0 truncate text-sm font-medium">{labelFor(rec)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={cn('rounded-full px-1.5 py-0.5 font-medium capitalize', pillClass)}>{rec.trackedDownloadStatus ?? rec.status}</span>
                    <span className="text-muted-foreground">
                      {formatSize(rec.size)}
                      {rec.quality?.quality?.name ? ` · ${rec.quality.quality.name}` : ''}
                      {rec.indexer ? ` · ${rec.indexer}` : ''}
                      {rec.downloadClient ? ` · ${rec.downloadClient}` : ''}
                    </span>
                  </div>
                  {warning && <p className="truncate text-xs text-amber-500">{warning}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <ProgressBar value={pct} className="mr-3 flex-1" />
                    <span className="shrink-0">{rec.timeleft ?? rec.status}</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {tab === 'history' && <ArrHistoryScreen instance={instance} apiVersion={apiVersion} />}

      {tab === 'server' && libraryConfig && <ArrOverviewScreen instance={instance} definition={definition} path={libraryConfig.path} kind={libraryConfig.kind} />}

      {definition.id === 'sonarr' && <AddSeriesDialog instance={instance} open={addOpen} onOpenChange={setAddOpen} onAdded={() => {}} />}
      {definition.id === 'radarr' && <AddMovieDialog instance={instance} open={addOpen} onOpenChange={setAddOpen} onAdded={() => {}} />}

      {selectedRecord && (
        <ArrQueueItemDialog
          instance={instance}
          apiVersion={apiVersion}
          serviceId={definition.id}
          record={{
            id: selectedRecord.id,
            downloadId: selectedRecord.downloadId,
            title: labelFor(selectedRecord),
            status: selectedRecord.trackedDownloadStatus ?? selectedRecord.status,
            indexer: selectedRecord.indexer,
            downloadClient: selectedRecord.downloadClient,
            warning: selectedRecord.statusMessages?.flatMap((m) => m.messages ?? []).join(' · ') || selectedRecord.errorMessage,
          }}
          onClose={() => setSelectedRecord(null)}
          onRemoved={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
