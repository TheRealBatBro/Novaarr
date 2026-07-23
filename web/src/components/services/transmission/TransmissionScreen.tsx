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

const Icon = getServiceIcon('transmission');

type TrTorrent = {
  id: number;
  name: string;
  percentDone: number;
  status: number; // 0=stopped, 4=downloading, 6=seeding, others=waiting/checking
  rateDownload: number;
};

type TrResponse = { arguments?: { torrents?: TrTorrent[] } };

const FIELDS = ['id', 'name', 'percentDone', 'status', 'rateDownload'];

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}

function rpc(method: string, ids?: number[], extraArgs?: Record<string, unknown>) {
  return { method, arguments: { fields: FIELDS, ids, ...extraArgs } };
}

export function TransmissionScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt } = useServiceProxy<TrResponse>(instance, {
    path: '/transmission/rpc',
    body: rpc('torrent-get'),
    refetchInterval: 5000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const torrents = data?.data?.arguments?.torrents ?? [];
  const totalKBs = data?.ok ? torrents.reduce((sum, t) => sum + t.rateDownload, 0) / 1024 : undefined;
  const history = useRollingHistory(totalKBs, dataUpdatedAt);

  const action = useMutation({
    mutationFn: ({ method, id }: { method: string; id: number }) =>
      proxyApi.call(instance.id, { path: '/transmission/rpc', body: rpc(method, [id]) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#cf4a3d22', color: '#cf4a3d' }}>
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
            <Sparkline data={history} color="#cf4a3d" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
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
            const stopped = t.status === 0;
            const busy = action.isPending && action.variables?.id === t.id;
            return (
              <TorrentRow
                key={t.id}
                title={t.name}
                subtitle={stopped ? 'Stopped' : formatSpeed(t.rateDownload)}
                progress={t.percentDone * 100}
                actions={[
                  stopped
                    ? { icon: Play, label: 'Start', disabled: busy, onClick: () => action.mutate({ method: 'torrent-start', id: t.id }) }
                    : { icon: Pause, label: 'Stop', disabled: busy, onClick: () => action.mutate({ method: 'torrent-stop', id: t.id }) },
                  { icon: Trash2, label: 'Remove', disabled: busy, onClick: () => action.mutate({ method: 'torrent-remove', id: t.id }) },
                ]}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
