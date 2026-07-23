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

const Icon = getServiceIcon('nzbget');

// Field names/casing are per NZBGet's documented JSON-RPC API but haven't been checked
// against a live instance — verify FileSizeMB/RemainingSizeMB/Status/DownloadRate if this doesn't line up.
type NzbGroup = {
  NZBID: number;
  NZBName: string;
  FileSizeMB: number;
  RemainingSizeMB: number;
  Status: string;
};

type NzbgetResponse = { result?: NzbGroup[] };
type NzbgetStatus = { result?: { DownloadRate?: number } };

function editQueue(command: string, nzbId: number) {
  return { method: 'editqueue', params: [command, 0, '', [nzbId]], id: 1 };
}

export function NzbgetScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading } = useServiceProxy<NzbgetResponse>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: { method: 'listgroups', params: [0], id: 1 },
    refetchInterval: 5000,
  });
  const { data: statusData, dataUpdatedAt } = useServiceProxy<NzbgetStatus>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: { method: 'status', params: [], id: 1 },
    refetchInterval: 5000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const groups = data?.data?.result ?? [];
  const speedKBs = statusData?.ok ? (statusData.data?.result?.DownloadRate ?? 0) / 1024 : undefined;
  const history = useRollingHistory(speedKBs, dataUpdatedAt);

  const action = useMutation({
    mutationFn: ({ command, nzbId }: { command: string; nzbId: number }) =>
      proxyApi.call(instance.id, { path: '/jsonrpc', method: 'POST', body: editQueue(command, nzbId) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#4caf5022', color: '#4caf50' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{status === 'offline' ? 'Unreachable' : 'Queue'}</p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
      </div>

      {status === 'online' && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Download speed (KB/s)</p>
            <Sparkline data={history} color="#4caf50" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          {!isLoading && groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing in the queue right now.</p>}
          {groups.map((g) => {
            const paused = g.Status?.includes('PAUSE');
            const pct = g.FileSizeMB > 0 ? ((g.FileSizeMB - g.RemainingSizeMB) / g.FileSizeMB) * 100 : 0;
            const busy = action.isPending && action.variables?.nzbId === g.NZBID;
            return (
              <TorrentRow
                key={g.NZBID}
                title={g.NZBName}
                subtitle={paused ? 'Paused' : g.Status}
                progress={pct}
                actions={[
                  paused
                    ? { icon: Play, label: 'Resume', disabled: busy, onClick: () => action.mutate({ command: 'GroupResume', nzbId: g.NZBID }) }
                    : { icon: Pause, label: 'Pause', disabled: busy, onClick: () => action.mutate({ command: 'GroupPause', nzbId: g.NZBID }) },
                  { icon: Trash2, label: 'Delete', disabled: busy, onClick: () => action.mutate({ command: 'GroupDelete', nzbId: g.NZBID }) },
                ]}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
