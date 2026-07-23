import { Pause, Play, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { TorrentRow } from '@/components/shared/TorrentRow';
import { WolButton } from '@/components/shared/WolButton';
import { Sparkline } from '@/components/shared/Sparkline';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import { getServiceIcon } from '@/lib/serviceIcons';
import { proxyApi, type ServiceInstance } from '@/lib/api';

const Icon = getServiceIcon('qbittorrent');

type QbTorrent = {
  hash: string;
  name: string;
  progress: number;
  state: string;
  dlspeed: number;
  upspeed: number;
};

const PAUSED_STATES = new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']);

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}

export function QBittorrentScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt } = useServiceProxy<QbTorrent[]>(instance, {
    path: '/api/v2/torrents/info',
    refetchInterval: 5000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const torrents = data?.data ?? [];
  const totalKBs = data?.ok ? torrents.reduce((sum, t) => sum + t.dlspeed, 0) / 1024 : undefined;
  const history = useRollingHistory(totalKBs, dataUpdatedAt);

  const action = useMutation({
    mutationFn: ({ path, hash, extra }: { path: string; hash: string; extra?: Record<string, string> }) =>
      proxyApi.call(instance.id, { path, method: 'POST', body: { hashes: hash, ...extra } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#2f67d822', color: '#2f67d8' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{status === 'offline' ? 'Unreachable' : 'Torrents'}</p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
      </div>

      {status === 'online' && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Total download speed (KB/s)</p>
            <Sparkline data={history} color="#2f67d8" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Torrents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          {!isLoading && torrents.length === 0 && <p className="text-sm text-muted-foreground">No torrents.</p>}
          {torrents.map((t) => {
            const paused = PAUSED_STATES.has(t.state);
            const busy = action.isPending && action.variables?.hash === t.hash;
            return (
              <TorrentRow
                key={t.hash}
                title={t.name}
                subtitle={paused ? 'Paused' : formatSpeed(t.dlspeed)}
                progress={t.progress * 100}
                actions={[
                  paused
                    ? { icon: Play, label: 'Resume', disabled: busy, onClick: () => action.mutate({ path: '/api/v2/torrents/resume', hash: t.hash }) }
                    : { icon: Pause, label: 'Pause', disabled: busy, onClick: () => action.mutate({ path: '/api/v2/torrents/pause', hash: t.hash }) },
                  {
                    icon: Trash2,
                    label: 'Delete',
                    disabled: busy,
                    onClick: () => action.mutate({ path: '/api/v2/torrents/delete', hash: t.hash, extra: { deleteFiles: 'false' } }),
                  },
                ]}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
