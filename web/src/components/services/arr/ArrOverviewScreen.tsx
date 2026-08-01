import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Settings, ExternalLink, RefreshCw, SearchX, BookmarkX, ChevronRight, HardDrive, AlertTriangle } from 'lucide-react';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { getServiceIcon } from '@/lib/serviceIcons';
import type { ServiceDefinition } from '@/lib/serviceRegistry';
import { isDownloaded, isMissing, getSizeOnDisk } from './ArrLibraryGrid';

type LibraryItem = {
  id: number;
  monitored: boolean;
  hasFile?: boolean;
  sizeOnDisk?: number;
  physicalRelease?: string;
  digitalRelease?: string;
  inCinemas?: string;
  firstAired?: string;
  statistics?: { percentOfEpisodes?: number; sizeOnDisk?: number };
};
type SystemStatus = { version?: string };
type DiskSpaceItem = { path: string; label?: string; freeSpace: number; totalSpace: number };
type HealthCheck = { source: string; type: 'ok' | 'notice' | 'warning' | 'error'; message: string; wikiUrl?: string };

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 GB';
  const tb = bytes / 1024 / 1024 / 1024 / 1024;
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} GB`;
}

function ActionRow({ icon: Icon, label, onClick, disabled }: { icon: typeof Settings; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left text-sm font-medium last:border-b-0 hover:bg-accent disabled:opacity-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function ArrOverviewScreen({
  instance,
  definition,
  path,
  kind,
}: {
  instance: ServiceInstance;
  definition: ServiceDefinition;
  path: string;
  kind: 'movie' | 'series';
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const Icon = getServiceIcon(instance.serviceId);
  const { data: statusResp } = useServiceProxy<SystemStatus>(instance, { path: '/api/v3/system/status', refetchInterval: false });
  const { data: listResp, isLoading } = useServiceProxy<LibraryItem[]>(instance, { path, refetchInterval: 60_000 });
  const { data: diskResp } = useServiceProxy<DiskSpaceItem[]>(instance, { path: '/api/v3/diskspace', refetchInterval: 300_000 });
  const { data: healthResp } = useServiceProxy<HealthCheck[]>(instance, { path: '/api/v3/health', refetchInterval: 60_000 });

  const disks = diskResp?.data ?? [];
  // "ok"/"notice" are routine — only warning/error are worth surfacing as something to act on.
  const healthIssues = (healthResp?.data ?? []).filter((h) => h.type === 'warning' || h.type === 'error');

  const items = listResp?.data ?? [];
  const downloaded = items.filter((i) => isDownloaded(i, kind)).length;
  const missing = items.filter((i) => isMissing(i, kind)).length;
  const totalSize = items.reduce((sum, i) => sum + getSizeOnDisk(i, kind), 0);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const runCommand = useMutation({
    mutationFn: (body: Record<string, unknown>) => proxyApi.call(instance.id, { path: '/api/v3/command', method: 'POST', body }),
    onSuccess: (res, body) => {
      if (!res.ok) return toast.error(res.error || 'Failed to start');
      toast.success(`${body.name} started`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to start'),
  });

  const unmonitorDownloaded = useMutation({
    mutationFn: () => {
      const ids = items.filter((i) => isDownloaded(i, kind)).map((i) => i.id);
      const idsKey = kind === 'movie' ? 'movieIds' : 'seriesIds';
      const editorPath = kind === 'movie' ? '/api/v3/movie/editor' : '/api/v3/series/editor';
      return proxyApi.call(instance.id, { path: editorPath, method: 'PUT', body: { [idsKey]: ids, monitored: false } });
    },
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to update');
      toast.success('Downloaded items unmonitored');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update'),
  });

  const openUrl = instance.preferredMode === 'remote' && instance.remoteUrl ? instance.remoteUrl : instance.localUrl;

  return (
    <div>
      <div className="mb-8 flex flex-col items-center rounded-2xl border border-border bg-gradient-to-b from-card to-transparent p-8 text-center">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${definition.brandColor}22`, color: definition.brandColor }}
        >
          <Icon className="h-9 w-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
        {statusResp?.data?.version && <p className="text-sm text-muted-foreground">Version {statusResp.data.version}</p>}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Library stats</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xl font-bold tabular-nums">{items.length}</p>
              <p className="text-xs text-muted-foreground">{kind === 'movie' ? 'Movies' : 'Series'}</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{downloaded}</p>
              <p className="text-xs text-muted-foreground">Downloaded</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{missing}</p>
              <p className="text-xs text-muted-foreground">Missing</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{formatSize(totalSize)}</p>
              <p className="text-xs text-muted-foreground">On disk</p>
            </div>
          </div>
        )}
      </div>

      {healthIssues.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {healthIssues.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{h.message}</span>
            </div>
          ))}
        </div>
      )}

      {disks.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <HardDrive className="h-4 w-4 text-muted-foreground" /> Disk space
          </p>
          <div className="flex flex-col gap-3">
            {disks.map((d, i) => {
              const usedFraction = d.totalSpace > 0 ? 1 - d.freeSpace / d.totalSpace : 0;
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{d.label || d.path}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatSize(d.freeSpace)} free of {formatSize(d.totalSpace)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={usedFraction > 0.9 ? 'h-full bg-destructive' : 'h-full bg-primary'}
                      style={{ width: `${Math.min(100, Math.max(0, usedFraction * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
        <ActionRow icon={Settings} label={`${instance.displayName} settings`} onClick={() => navigate({ to: '/settings/services' })} />
        {openUrl && (
          <ActionRow icon={ExternalLink} label={`Open ${instance.displayName} on the web`} onClick={() => window.open(openUrl, '_blank', 'noreferrer')} />
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ActionRow
          icon={RefreshCw}
          label="Update library"
          onClick={() => runCommand.mutate({ name: kind === 'movie' ? 'RefreshMovie' : 'RefreshSeries' })}
          disabled={runCommand.isPending}
        />
        <ActionRow
          icon={SearchX}
          label="Search all missing"
          onClick={() => runCommand.mutate({ name: kind === 'movie' ? 'MissingMoviesSearch' : 'MissingEpisodeSearch' })}
          disabled={runCommand.isPending}
        />
        <ActionRow
          icon={BookmarkX}
          label="Unmonitor all downloaded"
          onClick={() => unmonitorDownloaded.mutate()}
          disabled={unmonitorDownloaded.isPending || downloaded === 0}
        />
      </div>
    </div>
  );
}
