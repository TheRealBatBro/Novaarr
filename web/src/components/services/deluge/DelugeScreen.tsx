import { useState } from 'react';
import { Pause, Play, Trash2, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { TorrentRow } from '@/components/shared/TorrentRow';
import { AddTorrentDialog } from '@/components/shared/AddTorrentDialog';
import { Sparkline } from '@/components/shared/Sparkline';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import { getServiceIcon } from '@/lib/serviceIcons';
import { fileToBase64 } from '@/lib/utils';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { DELUGE_FIELDS, addTorrentBody, addTorrentFileBody, formatSpeed, type DelugeResponse } from './DelugeShared';

const Icon = getServiceIcon('deluge');

type DelugeRpcError = { error?: { message?: string } | string };

export function DelugeScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const { data, isLoading, dataUpdatedAt } = useServiceProxy<DelugeResponse>(instance, {
    path: '/json',
    body: { method: 'core.get_torrents_status', params: [{}, DELUGE_FIELDS] },
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

  // Deluge's JSON-RPC bridge returns HTTP 200 even when the call itself fails (e.g. a duplicate
  // torrent) — the failure shows up as a non-null `error` in the body, not the HTTP status, so
  // that has to be checked explicitly rather than just `res.ok`.
  const addTorrent = useMutation({
    mutationFn: (uri: string) => proxyApi.call<DelugeRpcError>(instance.id, { path: '/json', body: addTorrentBody(uri) }),
    onSuccess: (res) => {
      const err = res.data?.error;
      if (!res.ok || err) {
        const message = typeof err === 'string' ? err : err?.message;
        return toast.error(message || res.error || 'Failed to add torrent');
      }
      toast.success('Torrent added');
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add torrent'),
  });

  const addTorrentFile = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return proxyApi.call<DelugeRpcError>(instance.id, { path: '/json', body: addTorrentFileBody(file.name, base64) });
    },
    onSuccess: (res) => {
      const err = res.data?.error;
      if (!res.ok || err) {
        const message = typeof err === 'string' ? err : err?.message;
        return toast.error(message || res.error || 'Failed to add torrent');
      }
      toast.success('Torrent added');
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add torrent'),
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
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
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

      <AddTorrentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAddUrl={(url) => addTorrent.mutate(url)}
        onAddFile={(file) => addTorrentFile.mutate(file)}
        urlPending={addTorrent.isPending}
        filePending={addTorrentFile.isPending}
      />
    </div>
  );
}
