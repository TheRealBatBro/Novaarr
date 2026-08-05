import { useState } from 'react';
import { Pause, Play, Trash2, Plus, CheckSquare, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { SabnzbdAddDialog } from './SabnzbdAddDialog';
import { SabnzbdHistoryDetailDialog, type SabnzbdHistorySlot } from './SabnzbdHistoryDetailDialog';

const Icon = getServiceIcon('sabnzbd');

type SabnzbdSlot = {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: string;
  timeleft: string;
  eta?: string;
  priority?: string;
  cat?: string;
  mb?: string;
  mbleft?: string;
  size?: string;
  sizeleft?: string;
  avg_age?: string;
};

type SabnzbdQueue = {
  queue?: {
    status: string;
    /** Human-formatted (e.g. "1.2 M") — not safely parseable as a number. Use kbpersec instead. */
    speed: string;
    /** Raw KB/s as a plain numeric string — what the speed sparkline/header actually compute from. */
    kbpersec?: string;
    speedlimit?: string;
    paused?: boolean;
    noofslots?: number;
    slots: SabnzbdSlot[];
  };
};

type SabnzbdHistory = { history?: { slots?: SabnzbdHistorySlot[] } };

const TABS = ['queue', 'history'] as const;
type Tab = (typeof TABS)[number];

// SABnzbd reports these as a queue slot's `status` while it's actively being handled, not just
// "Downloading" — post-processing (repair/extract/verify) can take as long as the download
// itself for a large multi-part archive, and previously showed as a stalled-looking progress bar
// stuck at 100% with no indication anything was still happening.
const ACTIVE_STATUS_META: Record<string, { label: string; color: string }> = {
  Downloading: { label: 'Downloading', color: 'text-primary' },
  Queued: { label: 'Queued', color: 'text-muted-foreground' },
  Paused: { label: 'Paused', color: 'text-muted-foreground' },
  Checking: { label: 'Checking…', color: 'text-amber-500' },
  QuickCheck: { label: 'Quick-checking…', color: 'text-amber-500' },
  Verifying: { label: 'Verifying…', color: 'text-amber-500' },
  Repairing: { label: 'Repairing…', color: 'text-amber-500' },
  Extracting: { label: 'Extracting…', color: 'text-amber-500' },
  Moving: { label: 'Moving…', color: 'text-amber-500' },
  Running: { label: 'Running script…', color: 'text-amber-500' },
  Fetching: { label: 'Fetching NZB…', color: 'text-muted-foreground' },
};
// Anything not "downloading a payload" in the normal sense (queued/paused included) gets an
// indeterminate bar instead of a percentage — SABnzbd's own percentage field freezes at 100
// during these phases, which otherwise reads as the job having silently stalled.
const INDETERMINATE_STATUSES = new Set(['Checking', 'QuickCheck', 'Verifying', 'Repairing', 'Extracting', 'Moving', 'Running', 'Fetching']);

function formatMb(mb?: string): string | undefined {
  if (mb === undefined) return undefined;
  const n = Number(mb);
  if (!Number.isFinite(n)) return undefined;
  return n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${n.toFixed(0)} MB`;
}

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

export function SabnzbdScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('queue');
  useResetScrollOnChange(tab);
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueDetail, setQueueDetail] = useState<SabnzbdSlot | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SabnzbdHistorySlot | null>(null);

  const { data, isLoading, dataUpdatedAt } = useServiceProxy<SabnzbdQueue>(instance, {
    path: '/api',
    query: { mode: 'queue', output: 'json' },
    refetchInterval: 5000,
  });
  const { data: historyResp, isLoading: historyLoading } = useServiceProxy<SabnzbdHistory>(instance, {
    path: '/api',
    query: { mode: 'history', output: 'json', limit: '40' },
    refetchInterval: 30_000,
    enabled: tab === 'history',
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok ? 'online' : 'offline';
  const queue = data?.data?.queue;
  const slots = queue?.slots ?? [];
  const historySlots = historyResp?.data?.history?.slots ?? [];
  // `speed` is human-formatted text (e.g. "1.2 M") and was never safely parseable as a number —
  // that's what produced "NaN MB/s" in the header. `kbpersec` is the raw numeric KB/s value.
  const speedMBs = queue ? (Number(queue.kbpersec) || 0) / 1024 : undefined;
  const history = useRollingHistory(speedMBs, dataUpdatedAt);
  const paused = queue?.status === 'Paused';
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const effectiveSpeedLimit = speedLimit ?? Number(queue?.speedlimit ?? 0) ?? 0;

  const action = useMutation({
    mutationFn: (query: Record<string, string>) => proxyApi.call(instance.id, { path: '/api', query }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      setSelected(new Set());
      setSelectMode(false);
      setQueueDetail(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  function setSpeedLimitOnServer(percent: number) {
    // SABnzbd's speed-limit endpoint per its documented API — unverified against a live
    // instance, confirm this still matches your SABnzbd version if the slider has no effect.
    action.mutate({ mode: 'queue', name: 'speedlimit', value: String(percent) });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkDeleteQueue() {
    action.mutate({ mode: 'queue', name: 'delete', value: [...selected].join(',') });
  }

  function bulkDeleteHistory() {
    action.mutate({ mode: 'history', name: 'delete', value: [...selected].join(',') });
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }

  const ids = tab === 'queue' ? slots.map((s) => s.nzo_id) : historySlots.map((s) => s.nzo_id);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#f2b63222', color: '#f2b632' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {queue ? `${queue.status} · ${speedMBs!.toFixed(1)} MB/s` : status === 'offline' ? 'Unreachable' : 'Connecting…'}
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
          <Button
            variant="destructive"
            size="sm"
            disabled={action.isPending}
            onClick={tab === 'queue' ? bulkDeleteQueue : bulkDeleteHistory}
          >
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
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Speed (MB/s)</p>
                  <Sparkline data={history} color="#f2b632" formatValue={(v) => `${v.toFixed(1)} MB/s`} />
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
                    onClick={() => action.mutate({ mode: paused ? 'resume' : 'pause' })}
                  >
                    {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {paused ? 'Resume queue' : 'Pause queue'}
                  </Button>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Speed limit</span>
                      <span className="font-medium">{effectiveSpeedLimit === 0 ? 'Unlimited' : `${effectiveSpeedLimit}%`}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={effectiveSpeedLimit}
                      onChange={(e) => setSpeedLimit(Number(e.target.value))}
                      onMouseUp={(e) => setSpeedLimitOnServer(Number((e.target as HTMLInputElement).value))}
                      onTouchEnd={(e) => setSpeedLimitOnServer(Number((e.target as HTMLInputElement).value))}
                      className="w-full accent-primary"
                    />
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
              {slots.length === 0 && <p className="text-sm text-muted-foreground">Nothing in the queue right now.</p>}
              {slots.map((slot) => {
                const slotPaused = slot.status === 'Paused';
                const meta = ACTIVE_STATUS_META[slot.status];
                const indeterminate = INDETERMINATE_STATUSES.has(slot.status);
                const pct = Number(slot.percentage) || 0;
                const downloaded = formatMb(slot.mb && slot.mbleft ? String(Number(slot.mb) - Number(slot.mbleft)) : undefined);
                const total = formatMb(slot.mb);
                const sizeInfo = downloaded && total ? `${downloaded} of ${total}` : total;
                const subtitle = slotPaused
                  ? 'Paused'
                  : meta && indeterminate
                    ? meta.label
                    : [slot.timeleft, sizeInfo].filter(Boolean).join(' · ');
                const busy = action.isPending && action.variables?.value === slot.nzo_id;
                return (
                  <TorrentRow
                    key={slot.nzo_id}
                    title={slot.filename}
                    subtitle={subtitle}
                    progress={indeterminate ? undefined : pct}
                    indeterminate={indeterminate}
                    selectable={selectMode}
                    selected={selected.has(slot.nzo_id)}
                    onToggleSelect={() => toggleSelected(slot.nzo_id)}
                    onRowClick={selectMode ? () => toggleSelected(slot.nzo_id) : () => setQueueDetail(slot)}
                    actions={
                      selectMode
                        ? []
                        : [
                            slotPaused
                              ? {
                                  icon: Play,
                                  label: 'Resume',
                                  disabled: busy,
                                  onClick: () => action.mutate({ mode: 'queue', name: 'resume', value: slot.nzo_id }),
                                }
                              : {
                                  icon: Pause,
                                  label: 'Pause',
                                  disabled: busy,
                                  onClick: () => action.mutate({ mode: 'queue', name: 'pause', value: slot.nzo_id }),
                                },
                            {
                              icon: Trash2,
                              label: 'Delete',
                              disabled: busy,
                              onClick: () => action.mutate({ mode: 'queue', name: 'delete', value: slot.nzo_id }),
                            },
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
            {!historyLoading && historySlots.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
            {historySlots.map((slot) => {
              const failed = slot.status === 'Failed';
              return (
                <div
                  key={slot.nzo_id}
                  onClick={selectMode ? () => toggleSelected(slot.nzo_id) : () => setHistoryDetail(slot)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(slot.nzo_id)}
                      onChange={() => toggleSelected(slot.nzo_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0 accent-primary"
                      aria-label="Select"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{slot.name ?? slot.nzb_name ?? 'Unknown'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 font-medium',
                          failed ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success',
                        )}
                      >
                        {slot.status}
                      </span>
                      <span className="text-muted-foreground">
                        {slot.size}
                        {slot.size ? ' · ' : ''}
                        {relativeTime(slot.completed)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <SabnzbdAddDialog instance={instance} open={addOpen} onOpenChange={setAddOpen} />

      {historyDetail && <SabnzbdHistoryDetailDialog slot={historyDetail} onClose={() => setHistoryDetail(null)} />}

      {queueDetail && (
        <Dialog open onOpenChange={(o) => !o && setQueueDetail(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="truncate">{queueDetail.filename}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{ACTIVE_STATUS_META[queueDetail.status]?.label ?? queueDetail.status}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{queueDetail.percentage}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Downloaded</span>
                <span className="font-medium">
                  {formatMb(queueDetail.mb && queueDetail.mbleft ? String(Number(queueDetail.mb) - Number(queueDetail.mbleft)) : undefined) ?? '—'}
                  {formatMb(queueDetail.mb) ? ` of ${formatMb(queueDetail.mb)}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Time left</span>
                <span className="font-medium">{queueDetail.timeleft || '—'}</span>
              </div>
              {queueDetail.eta && (
                <div className="flex items-center justify-between border-b border-border py-2">
                  <span className="text-muted-foreground">ETA</span>
                  <span className="font-medium">{queueDetail.eta}</span>
                </div>
              )}
              {queueDetail.priority && (
                <div className="flex items-center justify-between border-b border-border py-2">
                  <span className="text-muted-foreground">Priority</span>
                  <span className="font-medium">{queueDetail.priority}</span>
                </div>
              )}
              {queueDetail.cat && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{queueDetail.cat}</span>
                </div>
              )}
            </div>
            <Button
              variant="destructive"
              className="mt-2"
              disabled={action.isPending}
              onClick={() => action.mutate({ mode: 'queue', name: 'delete', value: queueDetail.nzo_id })}
            >
              <Trash2 className="h-4 w-4" /> Remove download
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
