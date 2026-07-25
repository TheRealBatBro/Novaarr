import { useState } from 'react';
import { Pause, Play, Trash2, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { TorrentRow } from '@/components/shared/TorrentRow';
import { AddTorrentDialog } from '@/components/shared/AddTorrentDialog';
import { WolButton } from '@/components/shared/WolButton';
import { Sparkline } from '@/components/shared/Sparkline';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import { getServiceIcon } from '@/lib/serviceIcons';
import { fileToBase64 } from '@/lib/utils';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { addTorrentFileBody, formatBytes, formatSpeed, isPaused, multicallBody, parseTorrent, progressPct, statusLabel } from './RutorrentShared';

const Icon = getServiceIcon('rutorrent');

export function RutorrentScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, dataUpdatedAt } = useServiceProxy<unknown[][]>(instance, {
    path: '',
    body: multicallBody(),
    refetchInterval: 5000,
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const torrents = (data?.data ?? []).map(parseTorrent);
  const totalDlSpeed = torrents.reduce((sum, t) => sum + t.downRate, 0) / 1024;
  const history = useRollingHistory(status === 'online' ? totalDlSpeed : undefined, dataUpdatedAt);

  const action = useMutation({
    mutationFn: ({ body }: { body: { method: string; params: unknown[] }; hash: string }) => proxyApi.call(instance.id, { path: '', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  const addTorrent = useMutation({
    mutationFn: (url: string) => proxyApi.call(instance.id, { path: '', body: { method: 'load.start', params: ['', url] } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to add torrent');
      toast.success('Torrent added');
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add torrent'),
  });

  // load.raw_start takes the .torrent file's raw bytes directly (XML-RPC <base64>), unlike
  // load.start's URL/magnet string — rTorrent loads it immediately rather than fetching anything.
  const addTorrentFile = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return proxyApi.call(instance.id, { path: '', body: addTorrentFileBody(base64) });
    },
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to add torrent');
      toast.success('Torrent added');
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add torrent'),
  });

  function doAction(hash: string, method: string) {
    action.mutate({ hash, body: { method, params: [hash] } });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#7c5cd622', color: '#7c5cd6' }}>
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
            <Sparkline data={history} color="#7c5cd6" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
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
            const paused = isPaused(t);
            const busy = action.isPending && action.variables?.hash === t.hash;
            const subtitle = t.downRate > 0 ? formatSpeed(t.downRate) : `${statusLabel(t)} · ${formatBytes(t.sizeBytes)}`;
            return (
              <TorrentRow
                key={t.hash}
                title={t.name}
                subtitle={subtitle}
                progress={progressPct(t)}
                actions={[
                  paused
                    ? { icon: Play, label: 'Resume', disabled: busy, onClick: () => doAction(t.hash, '__start__') }
                    : { icon: Pause, label: 'Pause', disabled: busy, onClick: () => doAction(t.hash, 'd.stop') },
                  { icon: Trash2, label: 'Remove', disabled: busy, onClick: () => doAction(t.hash, 'd.erase') },
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
            <Input value={magnet} onChange={(e) => setMagnet(e.target.value)} placeholder="Magnet link or .torrent URL" autoFocus />
            <Button disabled={addTorrent.isPending || !magnet.trim()} onClick={() => addTorrent.mutate(magnet.trim())}>
              {addTorrent.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
