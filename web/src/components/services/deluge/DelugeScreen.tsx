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

const Icon = getServiceIcon('deluge');

type DelugeTorrent = { name: string; progress: number; state: string; download_payload_rate: number };
type DelugeResponse = { result?: Record<string, DelugeTorrent> };

const FIELDS = ['name', 'progress', 'state', 'download_payload_rate'];

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}

export function DelugeScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt } = useServiceProxy<DelugeResponse>(instance, {
    path: '/json',
    body: { method: 'core.get_torrents_status', params: [{}, FIELDS] },
    refetchInterval: 5000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const torrents = Object.entries(data?.data?.result ?? {});
  const totalKBs = data?.ok ? torrents.reduce((sum, [, t]) => sum + t.download_payload_rate, 0) / 1024 : undefined;
  const history = useRollingHistory(totalKBs, dataUpdatedAt);

  const action = useMutation({
    mutationFn: ({ method, id }: { method: string; id: string }) =>
      proxyApi.call(instance.id, { path: '/json', body: { method, params: method === 'core.remove_torrent' ? [id, false] : [[id]] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#52a2da22', color: '#52a2da' }}>
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
            <Sparkline data={history} color="#52a2da" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
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
          {torrents.map(([id, t]) => {
            const paused = t.state === 'Paused';
            const busy = action.isPending && action.variables?.id === id;
            return (
              <TorrentRow
                key={id}
                title={t.name}
                subtitle={paused ? 'Paused' : formatSpeed(t.download_payload_rate)}
                progress={t.progress}
                actions={[
                  paused
                    ? { icon: Play, label: 'Resume', disabled: busy, onClick: () => action.mutate({ method: 'core.resume_torrent', id }) }
                    : { icon: Pause, label: 'Pause', disabled: busy, onClick: () => action.mutate({ method: 'core.pause_torrent', id }) },
                  { icon: Trash2, label: 'Remove', disabled: busy, onClick: () => action.mutate({ method: 'core.remove_torrent', id }) },
                ]}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
