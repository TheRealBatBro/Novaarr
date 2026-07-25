import { useState } from 'react';
import { Pause, Play, Trash2, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { TorrentRow } from '@/components/shared/TorrentRow';
import { WolButton } from '@/components/shared/WolButton';
import { Sparkline } from '@/components/shared/Sparkline';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import { getServiceIcon } from '@/lib/serviceIcons';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { formatBytes, formatSpeed, isPaused, parseTorrent, statusLabel, type UtorrentListResponse } from './UtorrentShared';

const Icon = getServiceIcon('utorrent');

export function UtorrentScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [magnet, setMagnet] = useState('');

  const { data, isLoading, dataUpdatedAt } = useServiceProxy<UtorrentListResponse>(instance, {
    path: '/gui/',
    query: { list: '1' },
    refetchInterval: 5000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const torrents = (data?.data?.torrents ?? []).map(parseTorrent);
  const totalDlSpeed = torrents.reduce((sum, t) => sum + t.dlSpeed, 0) / 1024;
  const history = useRollingHistory(status === 'online' ? totalDlSpeed : undefined, dataUpdatedAt);

  const action = useMutation({
    mutationFn: ({ query }: { action: string; hash: string; query: Record<string, string> }) =>
      proxyApi.call(instance.id, { path: '/gui/', query }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  const addTorrent = useMutation({
    mutationFn: (url: string) => proxyApi.call(instance.id, { path: '/gui/', query: { action: 'add-url', s: url } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to add torrent');
      toast.success('Torrent added');
      setMagnet('');
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add torrent'),
  });

  function doAction(hash: string, act: string) {
    action.mutate({ action: act, hash, query: { action: act, hash } });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#6dbe4922', color: '#6dbe49' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{status === 'offline' ? 'Unreachable' : `${torrents.length} torrents`}</p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {status === 'online' && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Download speed (KB/s)</p>
            <Sparkline data={history} color="#6dbe49" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
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
            const paused = isPaused(t.status);
            const busy = action.isPending && action.variables?.hash === t.hash;
            const subtitle = t.dlSpeed > 0 ? formatSpeed(t.dlSpeed) : `${statusLabel(t.status)} · ${formatBytes(t.size)}`;
            return (
              <TorrentRow
                key={t.hash}
                title={t.name}
                subtitle={subtitle}
                progress={t.progressPct}
                actions={[
                  paused
                    ? { icon: Play, label: 'Resume', disabled: busy, onClick: () => doAction(t.hash, 'start') }
                    : { icon: Pause, label: 'Pause', disabled: busy, onClick: () => doAction(t.hash, 'pause') },
                  { icon: Trash2, label: 'Remove', disabled: busy, onClick: () => doAction(t.hash, 'removetorrent') },
                ]}
              />
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add torrent</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={magnet}
              onChange={(e) => setMagnet(e.target.value)}
              placeholder="Magnet link or .torrent URL"
              autoFocus
            />
            <Button disabled={addTorrent.isPending || !magnet.trim()} onClick={() => addTorrent.mutate(magnet.trim())}>
              {addTorrent.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
