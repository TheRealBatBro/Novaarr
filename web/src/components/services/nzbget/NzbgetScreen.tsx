import { useState } from 'react';
import { Pause, Play, Trash2, Plus, CheckSquare, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkline } from '@/components/shared/Sparkline';
import { TorrentRow } from '@/components/shared/TorrentRow';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { NzbgetAddDialog } from './NzbgetAddDialog';
import { NzbgetHistoryDetailDialog } from './NzbgetHistoryDetailDialog';
import { editQueueBody, rpcBody, statusLabel, type NzbGroup, type NzbStatus, type NzbHistoryItem } from './NzbgetShared';

const Icon = getServiceIcon('nzbget');

const TABS = ['queue', 'history'] as const;
type Tab = (typeof TABS)[number];

type NzbgetGroupsResp = { result?: NzbGroup[] };
type NzbgetStatusResp = { result?: NzbStatus };
type NzbgetHistoryResp = { result?: NzbHistoryItem[] };

function relativeTime(unixSeconds?: number): string {
  if (!unixSeconds) return '';
  const diffMs = Date.now() - unixSeconds * 1000;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}hr ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function NzbgetScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('queue');
  useResetScrollOnChange(tab);
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [queueDetail, setQueueDetail] = useState<NzbGroup | null>(null);
  const [historyDetail, setHistoryDetail] = useState<NzbHistoryItem | null>(null);
  const [rateInput, setRateInput] = useState('');

  const { data, isLoading, dataUpdatedAt } = useServiceProxy<NzbgetGroupsResp>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: rpcBody('listgroups', [0]),
    refetchInterval: 5000,
  });
  const { data: statusResp } = useServiceProxy<NzbgetStatusResp>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: rpcBody('status'),
    refetchInterval: 5000,
  });
  const { data: historyResp, isLoading: historyLoading } = useServiceProxy<NzbgetHistoryResp>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: rpcBody('history', [false]),
    refetchInterval: 30_000,
    enabled: tab === 'history',
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const groups = data?.data?.result ?? [];
  const historyItems = historyResp?.data?.result ?? [];
  const nzbStatus = statusResp?.data?.result;
  const speedKBs = nzbStatus?.DownloadRate !== undefined ? nzbStatus.DownloadRate / 1024 : undefined;
  const history = useRollingHistory(speedKBs, dataUpdatedAt);
  const paused = !!nzbStatus?.DownloadPaused;
  const currentLimitKBs = nzbStatus?.DownloadLimit ? Math.round(nzbStatus.DownloadLimit / 1024) : 0;

  const action = useMutation({
    mutationFn: (body: Record<string, unknown>) => proxyApi.call(instance.id, { path: '/jsonrpc', method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      setSelected(new Set());
      setSelectMode(false);
      setQueueDetail(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  function setRateOnServer(kbs: number) {
    action.mutate(rpcBody('rate', [kbs]));
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkDeleteQueue() {
    action.mutate(editQueueBody('GroupDelete', [...selected]));
  }

  function bulkDeleteHistory() {
    action.mutate(editQueueBody('HistoryFinalDelete', [...selected]));
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }

  const ids = tab === 'queue' ? groups.map((g) => g.NZBID) : historyItems.map((h) => h.NZBID);

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
          <p className="text-sm text-muted-foreground">
            {nzbStatus ? `${paused ? 'Paused' : 'Downloading'} · ${(speedKBs ?? 0).toFixed(0)} KB/s` : status === 'offline' ? 'Unreachable' : 'Connecting…'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setSelectMode(false);
                setSelected(new Set());
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                tab === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {ids.length > 0 && (
            <Button variant="outline" size="sm" onClick={toggleSelectMode}>
              {selectMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add NZB
          </Button>
        </div>
      </div>

      {selectMode && selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <span>{selected.size} selected</span>
          <Button variant="destructive" size="sm" disabled={action.isPending} onClick={tab === 'queue' ? bulkDeleteQueue : bulkDeleteHistory}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}

      {tab === 'queue' && (
        <>
          {status === 'online' && (
            <>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Speed (KB/s)</p>
                  <Sparkline data={history} color="#4caf50" formatValue={(v) => `${v.toFixed(0)} KB/s`} />
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Controls</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Button
                    variant="outline"
                    className="self-start"
                    disabled={action.isPending}
                    onClick={() => action.mutate(rpcBody(paused ? 'resumedownload' : 'pausedownload'))}
                  >
                    {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {paused ? 'Resume queue' : 'Pause queue'}
                  </Button>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Speed limit</span>
                      <span className="font-medium">{currentLimitKBs === 0 ? 'Unlimited' : `${currentLimitKBs} KB/s`}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="KB/s"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="outline" disabled={action.isPending || !rateInput.trim()} onClick={() => setRateOnServer(Number(rateInput))}>
                        Set
                      </Button>
                      <Button variant="outline" disabled={action.isPending} onClick={() => setRateOnServer(0)}>
                        Unlimited
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Queue</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              {!isLoading && groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing in the queue right now.</p>}
              {groups.map((g) => {
                const groupPaused = g.Status?.includes('PAUSED');
                const pct = g.FileSizeMB > 0 ? ((g.FileSizeMB - g.RemainingSizeMB) / g.FileSizeMB) * 100 : 0;
                const busy = action.isPending;
                return (
                  <TorrentRow
                    key={g.NZBID}
                    title={g.NZBName}
                    subtitle={groupPaused ? 'Paused' : statusLabel(g.Status)}
                    progress={pct}
                    selectable={selectMode}
                    selected={selected.has(g.NZBID)}
                    onToggleSelect={() => toggleSelected(g.NZBID)}
                    onRowClick={selectMode ? () => toggleSelected(g.NZBID) : () => setQueueDetail(g)}
                    actions={
                      selectMode
                        ? []
                        : [
                            groupPaused
                              ? { icon: Play, label: 'Resume', disabled: busy, onClick: () => action.mutate(editQueueBody('GroupResume', [g.NZBID])) }
                              : { icon: Pause, label: 'Pause', disabled: busy, onClick: () => action.mutate(editQueueBody('GroupPause', [g.NZBID])) },
                            { icon: Trash2, label: 'Delete', disabled: busy, onClick: () => action.mutate(editQueueBody('GroupDelete', [g.NZBID])) },
                          ]
                    }
                  />
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {historyLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            {!historyLoading && historyItems.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
            {historyItems.map((item) => {
              const failed = /FAILURE|FAILED/i.test(item.Status ?? '');
              return (
                <div
                  key={item.NZBID}
                  onClick={selectMode ? () => toggleSelected(item.NZBID) : () => setHistoryDetail(item)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(item.NZBID)}
                      onChange={() => toggleSelected(item.NZBID)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0 accent-primary"
                      aria-label="Select"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.Name ?? item.NZBName ?? 'Unknown'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={cn('rounded-full px-1.5 py-0.5 font-medium', failed ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success')}>
                        {statusLabel(item.Status)}
                      </span>
                      <span className="text-muted-foreground">
                        {item.FileSizeMB ? `${item.FileSizeMB} MB` : ''}
                        {item.FileSizeMB ? ' · ' : ''}
                        {relativeTime(item.HistoryTime)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <NzbgetAddDialog instance={instance} open={addOpen} onOpenChange={setAddOpen} />

      {historyDetail && <NzbgetHistoryDetailDialog item={historyDetail} onClose={() => setHistoryDetail(null)} />}

      {queueDetail && (
        <Dialog open onOpenChange={(o) => !o && setQueueDetail(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="truncate">{queueDetail.NZBName}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{statusLabel(queueDetail.Status)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium">{queueDetail.FileSizeMB} MB</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">{queueDetail.RemainingSizeMB} MB</span>
              </div>
              {queueDetail.Category && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{queueDetail.Category}</span>
                </div>
              )}
            </div>
            <Button
              variant="destructive"
              className="mt-2"
              disabled={action.isPending}
              onClick={() => action.mutate(editQueueBody('GroupDelete', [queueDetail.NZBID]))}
            >
              <Trash2 className="h-4 w-4" /> Remove download
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
